import enum
from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement, Select, case, delete, exists, select, update
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.catalog import (
    Artwork,
    Game,
    GameCategory,
    GameCollection,
    GameCompany,
    GameFranchise,
    GameGenre,
    GamePlatform,
    GameVideo,
    ReleaseDate,
    Screenshot,
)
from app.models.library import (
    GameProgress,
    GameTag,
    LibraryItem,
    LibraryStatus,
    MediaFormat,
    Note,
    PlaySession,
    PlayStatus,
)

# Repositories only add/flush/delete — they never commit. The service (or script) that
# calls them owns the transaction boundary, so a multi-step use case (e.g. importing a
# game plus its addons) commits exactly once, atomically.


@dataclass
class GameWithStatus:
    """A Game plus whether it's owned/wishlisted (and its play status/rating, if any),
    computed fresh via EXISTS/correlated-scalar-subquery on every query — never a stored
    counter that could drift out of sync with the library_items it's derived from."""

    game: Game
    owned: bool
    wishlisted: bool
    play_status: PlayStatus | None
    rating: float | None


def _owned_exists(game_id_column: ColumnElement[int]) -> ColumnElement[bool]:
    return exists().where(LibraryItem.game_id == game_id_column, LibraryItem.status == LibraryStatus.OWNED)


def _wishlisted_exists(game_id_column: ColumnElement[int]) -> ColumnElement[bool]:
    return exists().where(LibraryItem.game_id == game_id_column, LibraryItem.status == LibraryStatus.WISHLIST)


# A game can now have GameProgress on multiple platforms (one owned copy each). Game-level
# views (list/card/dashboard) can only show one status, so these pick a single "representative"
# row via priority order — Playing beats Completed beats Backlog beats Abandoned beats None —
# rather than assuming (as before per-platform tracking) that at most one row exists.
_PLAY_STATUS_PRIORITY = case(
    (GameProgress.play_status == PlayStatus.PLAYING, 0),
    (GameProgress.play_status == PlayStatus.COMPLETED, 1),
    (GameProgress.play_status == PlayStatus.BACKLOG, 2),
    (GameProgress.play_status == PlayStatus.ABANDONED, 3),
    else_=4,
)


def _play_status_subquery(game_id_column: ColumnElement[int]) -> ColumnElement[PlayStatus | None]:
    return (
        select(GameProgress.play_status)
        .where(GameProgress.game_id == game_id_column)
        .order_by(_PLAY_STATUS_PRIORITY)
        .limit(1)
        .scalar_subquery()
    )


def _rating_subquery(game_id_column: ColumnElement[int]) -> ColumnElement[float | None]:
    # Rides along with the same representative row as _play_status_subquery, so a game's
    # card badge and "your rating" reflect the same platform's progress consistently.
    return (
        select(GameProgress.rating)
        .where(GameProgress.game_id == game_id_column)
        .order_by(_PLAY_STATUS_PRIORITY)
        .limit(1)
        .scalar_subquery()
    )


def _row_to_game_with_status(row: Any) -> GameWithStatus:
    return GameWithStatus(game=row[0], owned=bool(row[1]), wishlisted=bool(row[2]), play_status=row[3], rating=row[4])


# What counts as a browsable "game" in the main games list / Dashboard / a Collection's or
# Series' own Details page (see _is_browsable_game's other callers in
# collection_repository.py/franchise_repository.py), as opposed to something only reachable
# through a parent's Addons tab (DLC/expansion/pack — kept off this list via parent_game_id
# already) or that's just metadata noise around a real game rather than something a user
# tracks as its own entry — community mods, seasons, updates, forks, episodes. Mirrors
# igdb_client._BROWSABLE_GAME_TYPES (search/import only ever offer these same categories to
# add in the first place) and frontend AddGame.tsx's ADDABLE_CATEGORIES — keep all three in
# sync. NULL stays included: better to show an unclassifiable game than silently hide it
# because IGDB never returned a category for it.
_BROWSABLE_CATEGORIES = (
    GameCategory.MAIN_GAME,
    GameCategory.BUNDLE,
    GameCategory.STANDALONE_EXPANSION,
    GameCategory.REMAKE,
    GameCategory.REMASTER,
    GameCategory.EXPANDED_GAME,
    GameCategory.PORT,
)


def _is_browsable_game(category_column: ColumnElement[GameCategory | None]) -> ColumnElement[bool]:
    return category_column.in_(_BROWSABLE_CATEGORIES) | category_column.is_(None)


class GameSortOption(enum.Enum):
    """The Games list previously had no sort options at all (always a hardcoded
    Game.name ascending) — a genuinely new capability, not an extension of an existing one."""

    NAME_ASC = "name_asc"
    NAME_DESC = "name_desc"
    RELEASE_DATE_ASC = "release_date_asc"
    RELEASE_DATE_DESC = "release_date_desc"


def _order_by_for_sort(sort: GameSortOption) -> ColumnElement[Any]:
    if sort == GameSortOption.NAME_DESC:
        return Game.name.desc()
    if sort == GameSortOption.RELEASE_DATE_ASC:
        return Game.first_release_date.asc()
    if sort == GameSortOption.RELEASE_DATE_DESC:
        return Game.first_release_date.desc()
    return Game.name.asc()


def _maybe_negate(clause: ColumnElement[bool], exclude: bool) -> ColumnElement[bool]:
    """Flips a filter's own predicate when its "Exclude" toggle is on — "show everything
    except what's selected" is just the logical negation of the same clause inclusion
    already uses, so every filter gets negative filtering for free with no new query shape."""
    return ~clause if exclude else clause


def _apply_optional_game_filters(
    stmt: Select[Any],
    *,
    search: str | None = None,
    platform_ids: list[int] | None = None,
    platform_exclude: bool = False,
    tag_ids: list[int] | None = None,
    tag_exclude: bool = False,
    collection_ids: list[int] | None = None,
    collection_exclude: bool = False,
    franchise_ids: list[int] | None = None,
    franchise_exclude: bool = False,
    categories: list[GameCategory] | None = None,
    category_exclude: bool = False,
    formats: list[MediaFormat] | None = None,
    format_exclude: bool = False,
    storefronts: list[str] | None = None,
    storefront_exclude: bool = False,
    sort: GameSortOption = GameSortOption.NAME_ASC,
) -> Select[Any]:
    """The Games list's whole optional filter set (search + 7 dimensions + sort), factored
    out of list_top_level_games so the Collection/Series "Addons" queries
    (collection_repository.list_addons_for_collection / franchise_repository.list_addons_for_franchise)
    can offer the exact same filters against a differently-scoped base query, with zero
    duplicated clause-building logic to drift out of sync."""
    if search:
        stmt = stmt.where(Game.name.ilike(f"%{search}%"))
    if platform_ids:
        # The platform of the user's *owned/wishlisted copy* (library_items), not
        # game_platforms — IGDB's full list of platforms a game was ever released on.
        clause = exists().where(LibraryItem.game_id == Game.id, LibraryItem.platform_id.in_(platform_ids))
        stmt = stmt.where(_maybe_negate(clause, platform_exclude))
    if tag_ids:
        clause = exists().where(GameTag.game_id == Game.id, GameTag.tag_id.in_(tag_ids))
        stmt = stmt.where(_maybe_negate(clause, tag_exclude))
    if categories:
        # No need to also validate against _BROWSABLE_CATEGORIES here — list_top_level_games'
        # own base .where() already restricts every row to that set (or NULL) before this
        # runs, so an out-of-range value here would just AND down to zero rows rather than
        # leaking a non-browsable category. The addons queries have no such base restriction,
        # but addons are never browsable-category anyway, so the same reasoning holds.
        stmt = stmt.where(_maybe_negate(Game.category.in_(categories), category_exclude))
    if collection_ids:
        clause = exists().where(GameCollection.game_id == Game.id, GameCollection.collection_id.in_(collection_ids))
        stmt = stmt.where(_maybe_negate(clause, collection_exclude))
    if franchise_ids:
        clause = exists().where(GameFranchise.game_id == Game.id, GameFranchise.franchise_id.in_(franchise_ids))
        stmt = stmt.where(_maybe_negate(clause, franchise_exclude))
    if formats:
        # Same "does this game have *any* library copy matching" shape as platform_ids above
        # — an independent exists() subquery, not correlated to the platform/storefront
        # filters' own matched row.
        clause = exists().where(LibraryItem.game_id == Game.id, LibraryItem.format.in_(formats))
        stmt = stmt.where(_maybe_negate(clause, format_exclude))
    if storefronts:
        clause = exists().where(LibraryItem.game_id == Game.id, LibraryItem.digital_storefront.in_(storefronts))
        stmt = stmt.where(_maybe_negate(clause, storefront_exclude))
    return stmt.order_by(_order_by_for_sort(sort))


def list_top_level_games(
    db: Session,
    search: str | None = None,
    platform_ids: list[int] | None = None,
    platform_exclude: bool = False,
    tag_ids: list[int] | None = None,
    tag_exclude: bool = False,
    collection_ids: list[int] | None = None,
    collection_exclude: bool = False,
    franchise_ids: list[int] | None = None,
    franchise_exclude: bool = False,
    categories: list[GameCategory] | None = None,
    category_exclude: bool = False,
    formats: list[MediaFormat] | None = None,
    format_exclude: bool = False,
    storefronts: list[str] | None = None,
    storefront_exclude: bool = False,
    sort: GameSortOption = GameSortOption.NAME_ASC,
    required_collection_id: int | None = None,
    required_franchise_id: int | None = None,
) -> list[GameWithStatus]:
    stmt = select(
        Game,
        _owned_exists(Game.id),
        _wishlisted_exists(Game.id),
        _play_status_subquery(Game.id),
        _rating_subquery(Game.id),
    ).where(Game.parent_game_id.is_(None), _is_browsable_game(Game.category))
    # Always-applied AND-scope, independent of the user-editable collection_ids/franchise_ids
    # OR-filter above/below — this is what lets a Collection/Series detail page hard-scope to
    # "games in *this* collection" while still letting the Series/Collections filter field
    # narrow further on top, rather than the two colliding into one OR-list.
    if required_collection_id is not None:
        stmt = stmt.where(
            exists().where(GameCollection.game_id == Game.id, GameCollection.collection_id == required_collection_id)
        )
    if required_franchise_id is not None:
        stmt = stmt.where(
            exists().where(GameFranchise.game_id == Game.id, GameFranchise.franchise_id == required_franchise_id)
        )
    stmt = _apply_optional_game_filters(
        stmt,
        search=search,
        platform_ids=platform_ids,
        platform_exclude=platform_exclude,
        tag_ids=tag_ids,
        tag_exclude=tag_exclude,
        collection_ids=collection_ids,
        collection_exclude=collection_exclude,
        franchise_ids=franchise_ids,
        franchise_exclude=franchise_exclude,
        categories=categories,
        category_exclude=category_exclude,
        formats=formats,
        format_exclude=format_exclude,
        storefronts=storefronts,
        storefront_exclude=storefront_exclude,
        sort=sort,
    )
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]


def _get_game_options() -> tuple[Any, ...]:
    # selectinload (separate SELECT...IN queries), not joinedload, for the one-to-many/
    # many-to-many richness relations — joining all of them in a single query would
    # multiply the one Game row by the cross product of every related row. joinedload is
    # still right for to-one relations, including the ones nested inside a selectinload
    # (parent_game here; genre/company/franchise/collection/platform within each
    # junction row below).
    return (
        joinedload(Game.parent_game),
        joinedload(Game.display_parent_game),
        selectinload(Game.genres).joinedload(GameGenre.genre),
        selectinload(Game.companies).joinedload(GameCompany.company),
        selectinload(Game.franchises).joinedload(GameFranchise.franchise),
        selectinload(Game.collections).joinedload(GameCollection.collection),
        selectinload(Game.platforms).joinedload(GamePlatform.platform),
        selectinload(Game.screenshots),
        selectinload(Game.artworks),
        selectinload(Game.videos),
        selectinload(Game.release_dates).joinedload(ReleaseDate.platform),
    )


def get_game(db: Session, game_id: int) -> GameWithStatus | None:
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .options(*_get_game_options())
        .where(Game.id == game_id)
    )
    row = db.execute(stmt).first()
    if row is None:
        return None
    return _row_to_game_with_status(row)


def get_game_by_uuid(db: Session, game_uuid: str) -> GameWithStatus | None:
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .options(*_get_game_options())
        .where(Game.uuid == game_uuid)
    )
    row = db.execute(stmt).first()
    return _row_to_game_with_status(row) if row else None


def get_game_by_slug(db: Session, slug: str) -> GameWithStatus | None:
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .options(*_get_game_options())
        .where(Game.slug == slug)
    )
    row = db.execute(stmt).first()
    return _row_to_game_with_status(row) if row else None


def get_game_by_igdb_id(db: Session, igdb_id: int) -> Game | None:
    return db.scalars(select(Game).where(Game.igdb_id == igdb_id)).first()


def list_igdb_linked_games(db: Session) -> list[tuple[int, str]]:
    """(id, name) pairs for every game with an igdb_id — the set a bulk resync job (see
    app/services/resync_collections_job.py) iterates. Manually-added games have no igdb_id
    to resync from (see game_service.resync_game) and are excluded."""
    stmt = select(Game.id, Game.name).where(Game.igdb_id.is_not(None)).order_by(Game.id)
    return [(row[0], row[1]) for row in db.execute(stmt)]


def list_addons(db: Session, parent_game_id: int) -> list[GameWithStatus]:
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .where(Game.parent_game_id == parent_game_id)
        .order_by(Game.name)
    )
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]


def create_manual_game(db: Session, **fields: Any) -> Game:
    """A game with no igdb_id — added by hand rather than imported, so there's nothing to
    resync against. See app/services/manual_game_service.py."""
    game = Game(**fields)
    db.add(game)
    db.flush()
    return game


def update_manual_game(db: Session, game: Game, **fields: Any) -> Game:
    for key, value in fields.items():
        setattr(game, key, value)
    db.flush()
    return game


def upsert_game_from_igdb(db: Session, igdb_id: int, auto_discovered: bool = False, **fields: Any) -> Game:
    # auto_discovered is a real param, not folded into **fields, deliberately: it must only
    # ever be set at insert time (see Game.auto_discovered's comment) — if it were just
    # another key in fields, a plain resync of an already-graduated (or still-undiscovered)
    # game would blindly overwrite its flag on every call instead of leaving it alone.
    game = get_game_by_igdb_id(db, igdb_id)
    if game is None:
        game = Game(igdb_id=igdb_id, auto_discovered=auto_discovered)
        db.add(game)

    for key, value in fields.items():
        setattr(game, key, value)

    db.flush()
    return game


def game_has_progress(db: Session, game_id: int) -> bool:
    return bool(db.scalar(select(exists().where(GameProgress.game_id == game_id))))


def merge_game(db: Session, source: Game, target: Game) -> None:
    """Re-points every user-data row (library status, progress, play sessions, notes,
    tags) and any addon children from `source` onto `target`, then deletes `source`.

    Originally written for Link-to-IGDB's addon-parent flow, where the freshly-imported
    `target` row is always one `import_game_from_igdb` just created (so it starts with zero
    rows in any of these tables). The duplicate-merge flow (merging a stale custom entry
    into a pre-existing IGDB-linked row) reuses this against a `target` that may already
    have data, which only matters for two tables here:
      - `GameTag` has a composite (game_id, tag_id) primary key, so a source row for a tag
        the target already has would violate it on a blind reassignment — deduped below by
        dropping those source rows first (lossless: target already carries that tag).
      - `GameProgress` is unique per game_id, so if both source and target already have a
        row this would violate that constraint. Unlike GameTag there's no lossless way to
        reconcile two real progress records automatically, so the caller must check
        `game_has_progress` on both sides and refuse the merge beforehand — not handled
        here.
    """
    dup_tag_ids = select(GameTag.tag_id).where(GameTag.game_id == target.id)
    db.execute(delete(GameTag).where(GameTag.game_id == source.id, GameTag.tag_id.in_(dup_tag_ids)))

    db.execute(update(LibraryItem).where(LibraryItem.game_id == source.id).values(game_id=target.id))
    db.execute(update(GameProgress).where(GameProgress.game_id == source.id).values(game_id=target.id))
    db.execute(update(PlaySession).where(PlaySession.game_id == source.id).values(game_id=target.id))
    db.execute(update(Note).where(Note.game_id == source.id).values(game_id=target.id))
    db.execute(update(GameTag).where(GameTag.game_id == source.id).values(game_id=target.id))
    db.execute(update(Game).where(Game.parent_game_id == source.id).values(parent_game_id=target.id))
    db.delete(source)
    db.flush()


def delete_game_with_addons(db: Session, game: Game) -> None:
    """Deletes the game, its addons, and every row that hangs off either: library_items,
    game_progress, play_sessions, notes, game_tags, plus the catalog-richness tables
    populated at import/resync time (genres/companies/franchises/collections/platforms/
    screenshots/artworks/videos/release_dates)."""
    addon_ids = list(db.scalars(select(Game.id).where(Game.parent_game_id == game.id)))
    game_ids = [game.id, *addon_ids]

    db.execute(delete(LibraryItem).where(LibraryItem.game_id.in_(game_ids)))
    db.execute(delete(GameProgress).where(GameProgress.game_id.in_(game_ids)))
    db.execute(delete(PlaySession).where(PlaySession.game_id.in_(game_ids)))
    db.execute(delete(Note).where(Note.game_id.in_(game_ids)))
    db.execute(delete(GameTag).where(GameTag.game_id.in_(game_ids)))
    db.execute(delete(GameGenre).where(GameGenre.game_id.in_(game_ids)))
    db.execute(delete(GamePlatform).where(GamePlatform.game_id.in_(game_ids)))
    db.execute(delete(GameCompany).where(GameCompany.game_id.in_(game_ids)))
    db.execute(delete(GameFranchise).where(GameFranchise.game_id.in_(game_ids)))
    db.execute(delete(GameCollection).where(GameCollection.game_id.in_(game_ids)))
    db.execute(delete(Screenshot).where(Screenshot.game_id.in_(game_ids)))
    db.execute(delete(Artwork).where(Artwork.game_id.in_(game_ids)))
    db.execute(delete(GameVideo).where(GameVideo.game_id.in_(game_ids)))
    db.execute(delete(ReleaseDate).where(ReleaseDate.game_id.in_(game_ids)))
    db.execute(delete(Game).where(Game.id.in_(game_ids)))
