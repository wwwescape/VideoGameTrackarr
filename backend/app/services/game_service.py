from typing import Any

from sqlalchemy.orm import Session

from app.core.identifiers import extract_uuid
from app.models.catalog import CompanyRole, Game, GameCategory, IgdbReleaseRegion
from app.repositories import (
    collection_repository,
    company_repository,
    franchise_repository,
    game_media_repository,
    game_repository,
    genre_repository,
    platform_repository,
)
from app.repositories.game_repository import GameWithStatus
from app.services import upload_service
from app.services.exceptions import ConflictError, NotFoundError
from app.services.igdb_client import IGDBClient

_COMPANY_ROLE_FLAGS = (
    ("developer", CompanyRole.DEVELOPER),
    ("publisher", CompanyRole.PUBLISHER),
    ("porting", CompanyRole.PORTING),
    ("supporting", CompanyRole.SUPPORTING),
)

# Only these categories represent content that extends an *existing* copy rather than
# something independently ownable/playable — the only ones where nesting under a parent
# (hidden from the main games list, cascade-deleted/resynced with it) is actually correct.
# Standalone expansions, bundles, remasters, etc. found via the parent_game backlink (see
# _upsert_from_igdb_payload) get a display-only link instead, via display_parent_game_id.
_HIERARCHICAL_ADDON_CATEGORIES = {GameCategory.DLC_ADDON, GameCategory.EXPANSION, GameCategory.PACK}


def search_local_games(db: Session, search: str | None = None) -> list[GameWithStatus]:
    return game_repository.list_top_level_games(db, search=search)


def get_game_detail(db: Session, game_id: int) -> GameWithStatus:
    result = game_repository.get_game(db, game_id)
    if result is None:
        raise NotFoundError(f"Game {game_id} not found")
    return result


def get_game_detail_by_identifier(db: Session, identifier: str) -> GameWithStatus:
    """Resolves a public game/addon identifier. A trailing UUID (manually-added games' own
    {name-slug}-{uuid}, or a bare UUID like Compare's ?ids= list) resolves by uuid only — no
    fallback to slug, same as the other entities' identifier never falling back to numeric
    id. Anything else is treated as an IGDB-sourced game's slug. See app/core/identifiers.py."""
    game_uuid = extract_uuid(identifier)
    result = (
        game_repository.get_game_by_uuid(db, game_uuid)
        if game_uuid
        else game_repository.get_game_by_slug(db, identifier)
    )
    if result is None:
        raise NotFoundError(f"Game {identifier} not found")
    return result


def list_addons(db: Session, game_id: int) -> list[GameWithStatus]:
    get_game_detail(db, game_id)  # 404 on a bogus parent id instead of silently returning []
    return game_repository.list_addons(db, game_id)


def delete_game(db: Session, game_id: int) -> None:
    game_with_status = get_game_detail(db, game_id)
    game_repository.delete_game_with_addons(db, game_with_status.game)
    db.commit()


async def import_game_from_igdb(db: Session, igdb_client: IGDBClient, igdb_id: int) -> GameWithStatus:
    """Imports (or re-syncs, if it already exists) a game and every game IGDB links back to
    it via parent_game. One commit for the whole operation — either the game and all its
    children land together, or none of them do."""
    igdb_games = await igdb_client.get_games_by_ids([igdb_id])
    if not igdb_games:
        raise NotFoundError(f"IGDB game {igdb_id} not found")

    game = _upsert_from_igdb_payload(db, igdb_games[0])

    # get_addons_by_parent_igdb_id only returns the hierarchical addon types (DLC/expansion/
    # pack) now — siblings a parent_game backlink also turns up (remasters, bundles,
    # standalone expansions, mods, ...) are independently ownable/playable, so importing
    # them as a side effect of importing *this* game is wrong; the user adds those
    # themselves, by searching for them directly. candidate_parent_id is just "here's a
    # known local parent" — _upsert_from_igdb_payload still decides structural vs
    # display-only based on the *child's own* category, same as the direct-import path.
    addons = await igdb_client.get_addons_by_parent_igdb_id(igdb_id)
    for addon in addons:
        _upsert_from_igdb_payload(db, addon, candidate_parent_id=game.id)

    db.commit()
    return get_game_detail(db, game.id)


async def resync_game(db: Session, igdb_client: IGDBClient, game_id: int) -> GameWithStatus:
    # A plain PK lookup, not get_game_detail() — that eager-loads every catalog-richness
    # relation (selectinload(Game.genres), etc.) just to check igdb_id. Doing that here,
    # before _sync_catalog_richness has run, caches those relations as empty on this
    # session's copy of the Game instance; eager loaders don't re-populate a relationship
    # that's already "loaded" on a cached instance (without populate_existing()), so the
    # *second* get_game_detail() call at the end of import_game_from_igdb would silently
    # keep serving the pre-sync empty collections instead of what was just written. Found
    # by actually resyncing a real game against IGDB and checking the response, not assumed.
    game = db.get(Game, game_id)
    if game is None:
        raise NotFoundError(f"Game {game_id} not found")
    if game.igdb_id is None:
        raise NotFoundError(f"Game {game_id} has no IGDB id to resync from")

    return await import_game_from_igdb(db, igdb_client, game.igdb_id)


async def link_game_to_igdb(db: Session, igdb_client: IGDBClient, game_id: int, igdb_id: int) -> GameWithStatus:
    """Turns a manually-added game into an IGDB-backed one: links this row's igdb_id (rather
    than going through import_game_from_igdb directly, which would create a brand new row
    and leave this one as an orphaned duplicate) then resyncs in place so it picks up full
    catalog richness immediately."""
    game = db.get(Game, game_id)
    if game is None:
        raise NotFoundError(f"Game {game_id} not found")
    if game.igdb_id is not None:
        raise ConflictError(f"Game {game_id} is already linked to IGDB")
    if game_repository.get_game_by_igdb_id(db, igdb_id) is not None:
        raise ConflictError(f"IGDB game {igdb_id} is already in your library")

    # import_game_from_igdb's main-game upsert path doesn't pass parent_game_id, so a
    # manually-added addon being linked directly (rather than its parent) would otherwise
    # get silently detached — restore it afterward if that happened.
    existing_parent_id = game.parent_game_id
    old_cover_url = game.cover_url
    game.igdb_id = igdb_id
    db.flush()

    result = await import_game_from_igdb(db, igdb_client, igdb_id)
    if existing_parent_id is not None and result.game.parent_game_id is None:
        result.game.parent_game_id = existing_parent_id
        db.commit()
    # The upsert above always overwrites cover_url with IGDB's own (or None) — any
    # previously-uploaded cover (see app/services/upload_service.py) is now orphaned.
    upload_service.delete_if_local_upload(old_cover_url)
    return result


async def link_addon_via_new_parent(
    db: Session, igdb_client: IGDBClient, game_id: int, addon_igdb_id: int
) -> GameWithStatus:
    """The addon-needs-its-parent-first path for Link to IGDB: imports the addon's parent
    (which cascades the addon itself in as a fresh row, alongside any of its siblings —
    same import_game_from_igdb the "Add Game > From IGDB" flow uses), then merges this
    manually-added game's library status/progress/notes/tags onto that fresh row and
    discards this one, so the user doesn't end up with a duplicate addon."""
    game = db.get(Game, game_id)
    if game is None:
        raise NotFoundError(f"Game {game_id} not found")
    if game.igdb_id is not None:
        raise ConflictError(f"Game {game_id} is already linked to IGDB")

    igdb_games = await igdb_client.get_games_by_ids([addon_igdb_id])
    if not igdb_games:
        raise NotFoundError(f"IGDB game {addon_igdb_id} not found")
    parent_ref = igdb_games[0].get("parent_game")
    if not isinstance(parent_ref, dict) or parent_ref.get("id") is None:
        raise ConflictError(f"IGDB game {addon_igdb_id} has no parent to import")

    old_cover_url = game.cover_url
    await import_game_from_igdb(db, igdb_client, parent_ref["id"])

    new_addon = game_repository.get_game_by_igdb_id(db, addon_igdb_id)
    if new_addon is None:
        raise NotFoundError(f"IGDB game {addon_igdb_id} was not imported as an addon of its parent")

    if new_addon.id != game.id:
        game_repository.merge_game(db, source=game, target=new_addon)
    db.commit()
    # game's own cover_url (if any) was never carried over to new_addon — same orphaned-
    # upload cleanup as link_game_to_igdb above.
    upload_service.delete_if_local_upload(old_cover_url)
    return get_game_detail(db, new_addon.id)


def resolve_igdb_category(igdb_game: dict[str, Any]) -> tuple[int | None, GameCategory | None]:
    # IGDB has migrated classification onto `game_type` — verified live that `category` is
    # now unset on essentially everything, including top-level games like Elden Ring, while
    # `game_type` uses the exact same 0-14 ordinal scheme (confirmed against IGDB's own
    # /game_types lookup table) and is reliably populated. Prefer it; fall back to `category`
    # for any response that somehow only has the legacy field.
    igdb_category_id = igdb_game.get("game_type")
    if igdb_category_id is None:
        igdb_category_id = igdb_game.get("category")
    return igdb_category_id, GameCategory.from_igdb_category_id(igdb_category_id)


def _upsert_from_igdb_payload(db: Session, igdb_game: dict[str, Any], candidate_parent_id: int | None = None) -> Game:
    igdb_category_id, category = resolve_igdb_category(igdb_game)

    external_parent_name = None
    external_parent_igdb_url = None
    if candidate_parent_id is None:
        # The cascade path (import_game_from_igdb's addon loop) already knows a local
        # candidate parent. Anything imported on its own — e.g. searched and added
        # directly, like "Age of Empires: Definitive Edition" or "Marvel's Spider-Man:
        # Miles Morales" — doesn't, even when IGDB's own parent_game backlink says it has
        # one; resolve a candidate from that here instead.
        parent_ref = igdb_game.get("parent_game")
        if isinstance(parent_ref, dict) and parent_ref.get("id") is not None:
            local_parent = game_repository.get_game_by_igdb_id(db, parent_ref["id"])
            if local_parent is not None:
                candidate_parent_id = local_parent.id
            else:
                external_parent_name = parent_ref.get("name")
                external_parent_igdb_url = parent_ref.get("url")

    # Whichever way a candidate parent was found, *this game's own category* — not how the
    # candidate was discovered — decides whether the relationship is structural (hidden from
    # the main games list, cascade-deleted/resynced with the parent — correct for DLC/
    # expansion/pack, content that extends an existing copy) or just a display-only link
    # (everything else: standalone expansions, bundles, remasters, etc. are independently
    # ownable/playable, so hiding them the same way is wrong — that's exactly what hid Miles
    # Morales the first time this was "fixed").
    parent_game_id = None
    display_parent_game_id = None
    if candidate_parent_id is not None:
        if category in _HIERARCHICAL_ADDON_CATEGORIES:
            parent_game_id = candidate_parent_id
        else:
            display_parent_game_id = candidate_parent_id

    game = game_repository.upsert_game_from_igdb(
        db,
        igdb_id=igdb_game["id"],
        name=igdb_game.get("name"),
        slug=igdb_game.get("slug"),
        summary=igdb_game.get("summary"),
        storyline=igdb_game.get("storyline"),
        igdb_url=igdb_game.get("url"),
        first_release_date=igdb_game.get("first_release_date"),
        cover_url=igdb_game.get("cover_url"),
        category=category,
        igdb_category_id=igdb_category_id,
        parent_game_id=parent_game_id,
        display_parent_game_id=display_parent_game_id,
        external_parent_name=external_parent_name,
        external_parent_igdb_url=external_parent_igdb_url,
        similar_game_igdb_ids=igdb_game.get("similar_games"),
    )

    _sync_catalog_richness(db, game, igdb_game)
    return game


def _sync_catalog_richness(db: Session, game: Game, igdb_game: dict[str, Any]) -> None:
    """Persists everything GAME_FIELDS' relation expansions add beyond the base columns —
    genres/companies/franchises/collections/platforms/screenshots/videos/release_dates.
    Each call replaces these wholesale: IGDB's current response is the source of truth on
    every resync, not something to merge with whatever was previously recorded."""
    genre_ids = [
        genre_repository.get_or_create_by_igdb(db, genre["id"], genre["name"], genre.get("slug")).id
        for genre in igdb_game.get("genres") or []
    ]
    genre_repository.sync_for_game(db, game.id, genre_ids)

    # A set, not a list: IGDB sometimes lists the same company in involved_companies more
    # than once with overlapping role flags (verified live — e.g. two separate entries for
    # the same publisher), which would otherwise produce duplicate (company_id, role) pairs
    # and violate game_companies' composite primary key.
    company_roles: set[tuple[int, CompanyRole]] = set()
    for involved in igdb_game.get("involved_companies") or []:
        company_data = involved.get("company")
        if not company_data:
            continue
        logo_url = (company_data.get("logo") or {}).get("url")
        company = company_repository.get_or_create_by_igdb(
            db, company_data["id"], company_data.get("name", ""), company_data.get("slug"), logo_url
        )
        for flag, role in _COMPANY_ROLE_FLAGS:
            if involved.get(flag):
                company_roles.add((company.id, role))
    company_repository.sync_for_game(db, game.id, sorted(company_roles, key=lambda pair: (pair[0], pair[1].value)))

    franchise_ids = [
        franchise_repository.get_or_create_by_igdb(db, franchise["id"], franchise["name"], franchise.get("slug")).id
        for franchise in igdb_game.get("franchises") or []
    ]
    franchise_repository.sync_for_game(db, game.id, franchise_ids)

    collection_ids = [
        collection_repository.get_or_create_by_igdb(db, coll["id"], coll["name"], coll.get("slug")).id
        for coll in igdb_game.get("collections") or []
    ]
    collection_repository.sync_for_game(db, game.id, collection_ids)

    platform_ids = [
        platform_repository.get_or_create_by_igdb(
            db, platform["id"], platform["name"], platform.get("slug"), platform.get("abbreviation")
        ).id
        for platform in igdb_game.get("platforms") or []
    ]
    platform_repository.sync_for_game(db, game.id, platform_ids)

    screenshots = [
        (screenshot["id"], screenshot["url"])
        for screenshot in igdb_game.get("screenshots") or []
        if screenshot.get("url")
    ]
    game_media_repository.sync_screenshots(db, game.id, screenshots)

    artworks = [
        (artwork["id"], artwork["url"]) for artwork in igdb_game.get("artworks") or [] if artwork.get("url")
    ]
    game_media_repository.sync_artworks(db, game.id, artworks)

    videos = [
        (video["id"], video.get("name"), video["video_id"])
        for video in igdb_game.get("videos") or []
        if video.get("video_id")
    ]
    game_media_repository.sync_videos(db, game.id, videos)

    release_dates = [
        game_media_repository.ReleaseDateInput(
            igdb_id=release_date["id"],
            date=release_date.get("date"),
            human=release_date.get("human"),
            # Looked up, not upserted: the platform should already exist from the
            # `platforms` sync above (a release date's platform is always one of the
            # game's own platforms) with full slug/abbreviation data — re-upserting here
            # with only id+name would silently clobber that richer data with nulls.
            platform_id=_release_date_platform_id(db, release_date.get("platform")),
            release_region=IgdbReleaseRegion.from_igdb_value(release_date.get("release_region")),
        )
        for release_date in igdb_game.get("release_dates") or []
    ]
    game_media_repository.sync_release_dates(db, game.id, release_dates)


def _release_date_platform_id(db: Session, platform_data: dict[str, Any] | None) -> int | None:
    if not platform_data:
        return None
    platform = platform_repository.get_by_igdb_id(db, platform_data["id"])
    return platform.id if platform else None
