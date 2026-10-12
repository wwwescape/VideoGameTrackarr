from sqlalchemy import delete, exists, func, select
from sqlalchemy.orm import Session

from app.models.catalog import Game, GameCategory, GamePlatform, Platform
from app.models.library import LibraryItem, MediaFormat
from app.repositories.game_repository import (
    GameSortOption,
    GameWithStatus,
    _apply_optional_game_filters,
    _is_browsable_game,
    _owned_exists,
    _play_status_subquery,
    _rating_subquery,
    _row_to_game_with_status,
    _wishlisted_exists,
)


def list_platforms(db: Session) -> list[Platform]:
    return list(db.scalars(select(Platform).order_by(Platform.name)))


def get_by_name(db: Session, name: str) -> Platform | None:
    return db.scalars(select(Platform).where(Platform.name == name)).first()


def get_or_create_by_name(db: Session, name: str) -> Platform:
    # CSV import names platforms/regions as free text (matching what a personal
    # spreadsheet would have) — get-or-create by name, same lenient pattern as tags.
    platform = get_by_name(db, name)
    if platform is not None:
        return platform

    platform = Platform(name=name)
    db.add(platform)
    db.flush()
    return platform


def get_by_igdb_id(db: Session, igdb_id: int) -> Platform | None:
    return db.scalars(select(Platform).where(Platform.igdb_id == igdb_id)).first()


def _fill_missing_abbreviation(platform: Platform, abbreviation: str | None) -> None:
    """Fill-only: an existing row gets IGDB's short name when it has none (e.g. rows created
    before platforms were linked to IGDB), but a value that's already there — curated by a
    migration or by hand — is never overwritten."""
    if abbreviation and not platform.abbreviation:
        platform.abbreviation = abbreviation


def get_or_create_by_igdb(db: Session, igdb_id: int, name: str, slug: str | None, abbreviation: str | None) -> Platform:
    platform = db.scalars(select(Platform).where(Platform.igdb_id == igdb_id)).first()
    if platform is not None:
        _fill_missing_abbreviation(platform, abbreviation)
        return platform

    # IGDB occasionally disambiguates a platform's slug with a trailing "--N" suffix (e.g.
    # "ps4--1") when its own catalog has more than one row for what's conceptually the same
    # hardware. A row from before this app tracked igdb_id (igdb_id is NULL) may already
    # represent that same platform under the bare slug — match on it and backfill the link
    # instead of inserting a parallel duplicate. Name/slug are deliberately left untouched
    # here and above: once a platform row exists, its display name may have been
    # deliberately curated (e.g. "Sony PlayStation 4") and shouldn't be silently overwritten
    # by IGDB's raw name on a later sync. The abbreviation is only ever filled when missing.
    bare_slug = slug.split("--")[0] if slug else None
    if bare_slug:
        platform = db.scalars(select(Platform).where(Platform.slug == bare_slug)).first()
        if platform is not None:
            platform.igdb_id = igdb_id
            _fill_missing_abbreviation(platform, abbreviation)
            db.flush()
            return platform

    platform = Platform(igdb_id=igdb_id, name=name, slug=slug, abbreviation=abbreviation)
    db.add(platform)
    db.flush()
    return platform


def sync_for_game(db: Session, game_id: int, platform_ids: list[int]) -> None:
    db.execute(delete(GamePlatform).where(GamePlatform.game_id == game_id))
    for platform_id in platform_ids:
        db.add(GamePlatform(game_id=game_id, platform_id=platform_id))
    db.flush()


def get_by_slug(db: Session, slug: str) -> Platform | None:
    return db.scalars(select(Platform).where(Platform.slug == slug)).first()


def list_platforms_with_counts(db: Session) -> list[tuple[Platform, int]]:
    """Every platform with its locally-known, browsable (non-addon) game count — a game
    counts for a platform when the user has a *copy* for it (library_items.platform_id),
    not merely because IGDB lists the game as released on it. Uses the same scoping as
    list_games_for_platform, so the count always matches what the platform's own page
    shows. Platforms with zero games are included with count 0; the browsable filter
    lives in the JOIN condition (not WHERE) so the outer join keeps zero-count
    platforms instead of dropping them."""
    stmt = (
        select(Platform, func.count(func.distinct(Game.id)))
        .outerjoin(LibraryItem, LibraryItem.platform_id == Platform.id)
        .outerjoin(
            Game,
            (Game.id == LibraryItem.game_id) & Game.parent_game_id.is_(None) & _is_browsable_game(Game.category),
        )
        .group_by(Platform.id)
        .order_by(Platform.name)
    )
    return [(platform, count) for platform, count in db.execute(stmt)]


def list_games_for_platform(db: Session, platform_id: int) -> list[GameWithStatus]:
    """Only games the user actually has a copy for on this platform — scoped by
    library_items.platform_id (the platform on the owned/wishlisted copy), not
    game_platforms (IGDB's full list of platforms the game was ever released on).
    An addon's platform link would otherwise clutter the grid; addons stay reachable
    via the parent's own Addons tab and the page's "Include addons" toggle."""
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .where(
            exists().where(
                LibraryItem.game_id == Game.id,
                LibraryItem.platform_id == platform_id,
            ),
            Game.parent_game_id.is_(None),
            _is_browsable_game(Game.category),
        )
        .order_by(Game.name)
    )
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]


def list_addons_for_platform(
    db: Session,
    platform_id: int,
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
    steelbook_only: bool = False,
    sort: GameSortOption = GameSortOption.NAME_ASC,
) -> list[GameWithStatus]:
    """Addons of this platform's top-level games — same parent-based approach as
    collection_repository.list_addons_for_collection: an addon inherits its platform
    through its parent, so this goes via the parent ids. The parent is scoped by the
    user's copies (library_items.platform_id), not the catalog release list."""
    parent_ids = select(Game.id).where(
        exists().where(
            LibraryItem.game_id == Game.id,
            LibraryItem.platform_id == platform_id,
        ),
        Game.parent_game_id.is_(None),
        _is_browsable_game(Game.category),
    )
    stmt = select(
        Game,
        _owned_exists(Game.id),
        _wishlisted_exists(Game.id),
        _play_status_subquery(Game.id),
        _rating_subquery(Game.id),
    ).where(Game.parent_game_id.in_(parent_ids))
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
        steelbook_only=steelbook_only,
        sort=sort,
    )
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]
