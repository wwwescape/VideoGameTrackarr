from sqlalchemy import exists, select
from sqlalchemy.orm import Session, aliased, joinedload

from app.models.catalog import Game, GameCategory
from app.models.hardware import Accessory, AccessoryDeviceLink, UserAccessory, UserDevice
from app.models.library import LibraryItem, LibraryStatus, MediaFormat, PlayStatus
from app.repositories.game_repository import GameSortOption, GameSource, _apply_optional_game_filters

# Mirrors the frontend's ADDON_DISPLAY_CATEGORIES (GameAddonsTab.tsx) — bundles, standalone
# expansions, mods, updates, etc. all carry parent_game too, but aren't "DLC" a user would
# go acquire, so they shouldn't show up as something "missing".
_DLC_LIKE_CATEGORIES = (GameCategory.DLC_ADDON, GameCategory.EXPANSION, GameCategory.PACK)


def find_duplicate_library_items(db: Session) -> list[list[LibraryItem]]:
    """Groups of library_items that are identical in every way that matters (same game,
    status, platform, region, format, edition) — almost certainly an accidental double
    entry rather than two intentionally distinct copies.

    Grouped in Python, not SQL: a `GROUP BY ... HAVING count(*) > 1` correctly treats two
    NULLs as the same group, but re-fetching those rows via a row-value `(...) IN (...)`
    comparison does not — standard `=` semantics make `NULL = NULL` unknown, not true, so
    that approach silently dropped every duplicate that had a NULL key column (platform/
    region/format/edition are all nullable). The library_items table is small enough for a
    personal collection that grouping the full table in Python is simpler and correct."""
    stmt = select(LibraryItem).options(
        joinedload(LibraryItem.game), joinedload(LibraryItem.platform), joinedload(LibraryItem.region)
    )

    groups: dict[tuple, list[LibraryItem]] = {}
    for item in db.scalars(stmt):
        key = (item.game_id, item.status, item.platform_id, item.region_id, item.format, item.edition)
        groups.setdefault(key, []).append(item)
    return [group for group in groups.values() if len(group) > 1]


def find_missing_addons(
    db: Session,
    search: str | None = None,
    platform_ids: list[int] | None = None,
    platform_exclude: bool = False,
    platform_match_all: bool = False,
    tag_ids: list[int] | None = None,
    tag_exclude: bool = False,
    tag_match_all: bool = False,
    collection_ids: list[int] | None = None,
    collection_exclude: bool = False,
    collection_match_all: bool = False,
    franchise_ids: list[int] | None = None,
    franchise_exclude: bool = False,
    franchise_match_all: bool = False,
    categories: list[GameCategory] | None = None,
    category_exclude: bool = False,
    formats: list[MediaFormat] | None = None,
    format_exclude: bool = False,
    format_match_all: bool = False,
    storefronts: list[str] | None = None,
    storefront_exclude: bool = False,
    storefront_match_all: bool = False,
    play_statuses: list[PlayStatus] | None = None,
    play_status_exclude: bool = False,
    play_status_match_all: bool = False,
    steelbook_only: bool = False,
    sources: list[GameSource] | None = None,
    source_exclude: bool = False,
    sort: GameSortOption = GameSortOption.NAME_ASC,
) -> list[tuple[Game, list[tuple[Game, bool]]]]:
    """For every owned, top-level game: its DLC/expansions/packs (per parent_game_id,
    restricted to _DLC_LIKE_CATEGORIES) that aren't themselves owned, plus whether each one
    is at least wishlisted (an addon can never be "owned" here — that's what ~addon_owned
    below already excludes). One query, not N+1 — joins each owned game to its unowned
    addons directly.

    The optional filters mirror game_repository.list_top_level_games' exact set (via the
    same shared _apply_optional_game_filters helper), applied to the *owned* top-level game
    — Game is the real (non-aliased) model class here, the same one that helper's exists()
    clauses correlate to, so they bind to the parent row and never to Addon. steelbook_only
    follows the same rule: it filters on the owned parent's own LibraryItem, same as formats/
    storefronts already do here — an addon is never itself owned (that's the whole premise of
    "missing"), so there's no Addon-level copy to check it against."""
    Addon = aliased(Game)
    addon_owned = exists().where(LibraryItem.game_id == Addon.id, LibraryItem.status == LibraryStatus.OWNED)
    addon_wishlisted = exists().where(LibraryItem.game_id == Addon.id, LibraryItem.status == LibraryStatus.WISHLIST)
    game_owned = exists().where(LibraryItem.game_id == Game.id, LibraryItem.status == LibraryStatus.OWNED)

    stmt = (
        select(Game, Addon, addon_wishlisted)
        .join(Addon, Addon.parent_game_id == Game.id)
        .where(
            Game.parent_game_id.is_(None),
            game_owned,
            ~addon_owned,
            Addon.category.in_(_DLC_LIKE_CATEGORIES),
        )
    )
    stmt = _apply_optional_game_filters(
        stmt,
        search=search,
        platform_ids=platform_ids,
        platform_exclude=platform_exclude,
        platform_match_all=platform_match_all,
        tag_ids=tag_ids,
        tag_exclude=tag_exclude,
        tag_match_all=tag_match_all,
        collection_ids=collection_ids,
        collection_exclude=collection_exclude,
        collection_match_all=collection_match_all,
        franchise_ids=franchise_ids,
        franchise_exclude=franchise_exclude,
        franchise_match_all=franchise_match_all,
        categories=categories,
        category_exclude=category_exclude,
        formats=formats,
        format_exclude=format_exclude,
        format_match_all=format_match_all,
        storefronts=storefronts,
        storefront_exclude=storefront_exclude,
        storefront_match_all=storefront_match_all,
        play_statuses=play_statuses,
        play_status_exclude=play_status_exclude,
        play_status_match_all=play_status_match_all,
        steelbook_only=steelbook_only,
        sources=sources,
        source_exclude=source_exclude,
        sort=sort,
    )
    # _apply_optional_game_filters' own order_by only covers Game's sort field — Addon.name
    # is an extra tiebreaker so each group's addons stay stably ordered, same as before this
    # gained filters/sort (order_by is additive, not a replacement, across multiple calls).
    stmt = stmt.order_by(Addon.name)

    grouped: dict[int, tuple[Game, list[tuple[Game, bool]]]] = {}
    order: list[int] = []
    for game, addon, wishlisted in db.execute(stmt):
        if game.id not in grouped:
            grouped[game.id] = (game, [])
            order.append(game.id)
        grouped[game.id][1].append((addon, bool(wishlisted)))
    return [grouped[game_id] for game_id in order]


def find_accessories_without_owned_hardware(db: Session) -> list[Accessory]:
    """Owned accessories where none of their linked devices (AccessoryDeviceLink — the
    specific-device link, not just platform compatibility) are themselves owned, including
    accessories with no linked devices at all. No .correlate() needed here despite the
    nested exists(): the outer query's FROM is Accessory alone, and neither
    AccessoryDeviceLink nor UserDevice (referenced inside has_owned_linked_device) appear in
    it, so SQLAlchemy's auto-correlation already does the right thing."""
    owned_exists = exists().where(
        UserAccessory.accessory_id == Accessory.id, UserAccessory.status == LibraryStatus.OWNED
    )
    has_owned_linked_device = exists().where(
        AccessoryDeviceLink.accessory_id == Accessory.id,
        AccessoryDeviceLink.device_id == UserDevice.device_id,
        UserDevice.status == LibraryStatus.OWNED,
    )

    stmt = (
        select(Accessory)
        .options(joinedload(Accessory.manufacturer))
        .where(owned_exists, ~has_owned_linked_device)
        .order_by(Accessory.official_name)
    )
    return list(db.scalars(stmt))
