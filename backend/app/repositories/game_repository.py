import enum
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement, Select, and_, case, delete, exists, func, or_, select, update
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
    Platform,
    ReleaseDate,
    Screenshot,
)
from app.models.igdb_import import IgdbImportEntry
from app.models.library import (
    GameProgress,
    GameTag,
    LibraryItem,
    LibraryStatus,
    MediaFormat,
    Note,
    PlaySession,
    PlayStatus,
    RomFile,
    RomSaveState,
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
    # Your overall rating (Game.user_rating), 1-10.
    rating: int | None


def platform_copy_exists(
    game_id_column: ColumnElement[int],
    platform_id: int,
    media_format: MediaFormat | None = None,
    storefront: str | None = None,
) -> ColumnElement[bool]:
    """A library copy (owned or wishlisted) on this platform — optionally only one in this
    format and, for digital copies, from this storefront (None meaning "no storefront set").
    Every condition is on the *same* copy, so a game owned on Steam but wishlisted on GOG
    matches each storefront on its own. Copies with no format count as "other"."""
    conditions = [LibraryItem.game_id == game_id_column, LibraryItem.platform_id == platform_id]
    if media_format is not None:
        if media_format == MediaFormat.OTHER:
            conditions.append(or_(LibraryItem.format == MediaFormat.OTHER, LibraryItem.format.is_(None)))
        else:
            conditions.append(LibraryItem.format == media_format)
        if media_format == MediaFormat.DIGITAL:
            conditions.append(func.coalesce(LibraryItem.digital_storefront, "") == (storefront or ""))
    return exists().where(*conditions)


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


def is_top_level_browsable(game: Game) -> bool:
    """Python-side twin of list_top_level_games' base .where(): whether a loaded game would
    appear on the main Games list (and so on the public share page)."""
    return game.parent_game_id is None and (game.category is None or game.category in _BROWSABLE_CATEGORIES)


class GameSortOption(enum.Enum):
    """The Games list previously had no sort options at all (always a hardcoded
    Game.name ascending) — a genuinely new capability, not an extension of an existing one."""

    NAME_ASC = "name_asc"
    NAME_DESC = "name_desc"
    RELEASE_DATE_ASC = "release_date_asc"
    RELEASE_DATE_DESC = "release_date_desc"
    # When the game was added here (its row's created_at).
    DATE_ADDED_DESC = "date_added_desc"
    DATE_ADDED_ASC = "date_added_asc"
    # One pair per Table view column (see _order_by_for_sort for each order).
    TYPE_ASC = "type_asc"
    TYPE_DESC = "type_desc"
    PLATFORMS_ASC = "platforms_asc"
    PLATFORMS_DESC = "platforms_desc"
    PLAY_STATUS_ASC = "play_status_asc"
    PLAY_STATUS_DESC = "play_status_desc"
    RATING_ASC = "rating_asc"
    RATING_DESC = "rating_desc"
    LIBRARY_ASC = "library_asc"
    LIBRARY_DESC = "library_desc"
    # The On sale / Missing / Custom chips. On sale isn't a column (it's worked out from the
    # price providers in Python), so these sort by name here and the routes reorder with
    # game_service.sort_by_labels.
    LABELS_ASC = "labels_asc"
    LABELS_DESC = "labels_desc"


# Sorts that read a game's copies, progress, rating or sale state — kept off the public share
# page, which doesn't show them (see routes/public.py).
PRIVATE_SORTS = frozenset(
    {
        GameSortOption.PLATFORMS_ASC,
        GameSortOption.PLATFORMS_DESC,
        GameSortOption.PLAY_STATUS_ASC,
        GameSortOption.PLAY_STATUS_DESC,
        GameSortOption.RATING_ASC,
        GameSortOption.RATING_DESC,
        GameSortOption.LABELS_ASC,
        GameSortOption.LABELS_DESC,
    }
)


class GameSource(enum.Enum):
    """Where a game's metadata comes from — imported from IGDB, or added by hand via the
    manual game form (no igdb_id; shown with a "Custom" chip on its card)."""

    IGDB = "igdb"
    CUSTOM = "custom"


def _rank(value: ColumnElement[Any], order: list[Any]) -> ColumnElement[int | None]:
    """A value's position in a fixed order, NULL for anything not in it."""
    return case(*((value == item, index) for index, item in enumerate(order)), else_=None)


# Type: browsable games in a fixed order (labels are translated, so not A-Z), then add-ons.
_TYPE_ORDER = [
    GameCategory.MAIN_GAME,
    GameCategory.REMAKE,
    GameCategory.REMASTER,
    GameCategory.EXPANDED_GAME,
    GameCategory.STANDALONE_EXPANSION,
    GameCategory.PORT,
    GameCategory.BUNDLE,
    GameCategory.DLC_ADDON,
    GameCategory.EXPANSION,
    GameCategory.PACK,
    GameCategory.EPISODE,
    GameCategory.SEASON,
    GameCategory.MOD,
    GameCategory.FORK,
    GameCategory.UPDATE,
]
_PLAY_STATUS_ORDER = [PlayStatus.PLAYING, PlayStatus.BACKLOG, PlayStatus.COMPLETED, PlayStatus.ABANDONED]


def _first_copy_platform(game_id_column: ColumnElement[int]) -> ColumnElement[str | None]:
    # The first of the platform labels the Table view lists (library_item_repository.list_copy_platforms).
    return (
        select(func.min(func.coalesce(Platform.abbreviation, Platform.name)))
        .join(LibraryItem, LibraryItem.platform_id == Platform.id)
        .where(LibraryItem.game_id == game_id_column)
        .scalar_subquery()
    )


def _library_rank(game_id_column: ColumnElement[int]) -> ColumnElement[int | None]:
    # Owned + wishlisted, owned, wishlisted; NULL (last either way) for neither.
    owned = _owned_exists(game_id_column)
    wishlisted = _wishlisted_exists(game_id_column)
    return case((and_(owned, wishlisted), 0), (owned, 1), (wishlisted, 2), else_=None)


def _order_by_for_sort(sort: GameSortOption) -> list[ColumnElement[Any]]:
    """The sort's own order, empty values (no date, no rating, not in the library...) last
    in either direction, then by name so ties read A-Z."""
    if sort == GameSortOption.NAME_DESC:
        return [Game.name.desc()]
    value: ColumnElement[Any]
    if sort in (GameSortOption.RELEASE_DATE_ASC, GameSortOption.RELEASE_DATE_DESC):
        value = Game.first_release_date
    elif sort in (GameSortOption.DATE_ADDED_ASC, GameSortOption.DATE_ADDED_DESC):
        value = Game.created_at
    elif sort in (GameSortOption.TYPE_ASC, GameSortOption.TYPE_DESC):
        value = _rank(Game.category, _TYPE_ORDER)
    elif sort in (GameSortOption.PLATFORMS_ASC, GameSortOption.PLATFORMS_DESC):
        value = _first_copy_platform(Game.id)
    elif sort in (GameSortOption.PLAY_STATUS_ASC, GameSortOption.PLAY_STATUS_DESC):
        value = _rank(_play_status_subquery(Game.id), _PLAY_STATUS_ORDER)
    elif sort in (GameSortOption.RATING_ASC, GameSortOption.RATING_DESC):
        value = Game.user_rating
    elif sort in (GameSortOption.LIBRARY_ASC, GameSortOption.LIBRARY_DESC):
        value = _library_rank(Game.id)
    else:
        # NAME_ASC, and LABELS_* (reordered by game_service.sort_by_labels afterwards).
        return [Game.name.asc()]
    direction = value.desc() if sort.value.endswith("_desc") else value.asc()
    return [value.is_(None), direction, Game.name.asc()]


def _maybe_negate(clause: ColumnElement[bool], exclude: bool) -> ColumnElement[bool]:
    """Flips a filter's own predicate when its "Exclude" toggle is on — "show everything
    except what's selected" is just the logical negation of the same clause inclusion
    already uses, so every filter gets negative filtering for free with no new query shape."""
    return ~clause if exclude else clause


def _match_values(
    build: Callable[[list[Any]], ColumnElement[bool]], values: list[Any], match_all: bool
) -> ColumnElement[bool]:
    """A list filter's "Any"/"All" choice. Any is one clause over every selected value
    ("has at least one of these"); All is one clause per value, ANDed ("has every one of
    these"). Both go through the same builder, so Exclude (_maybe_negate) composes with
    either: Exclude + All hides only games that match every selected value."""
    if match_all and len(values) > 1:
        return and_(*(build([value]) for value in values))
    return build(values)


def _play_status_clause(statuses: list[PlayStatus]) -> ColumnElement[bool]:
    """Matches when *any* of the game's platforms has one of these statuses, the same "any
    copy" rule the platform/format filters use, not the single priority-picked status a card
    shows (_play_status_subquery). NONE ("Not started") can't be a plain IN value: most
    unstarted games have no GameProgress row at all, so it means "no platform has a real
    status yet" instead."""
    clauses = []
    started = [status for status in statuses if status != PlayStatus.NONE]
    if started:
        clauses.append(exists().where(GameProgress.game_id == Game.id, GameProgress.play_status.in_(started)))
    if PlayStatus.NONE in statuses:
        clauses.append(~exists().where(GameProgress.game_id == Game.id, GameProgress.play_status != PlayStatus.NONE))
    return or_(*clauses)


def _apply_optional_game_filters(
    stmt: Select[Any],
    *,
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
) -> Select[Any]:
    """The Games list's whole optional filter set (search + 8 dimensions + sort), factored
    out of list_top_level_games so the Collection/Series "Addons" queries
    (collection_repository.list_addons_for_collection / franchise_repository.list_addons_for_franchise)
    can offer the exact same filters against a differently-scoped base query, with zero
    duplicated clause-building logic to drift out of sync."""
    if search:
        stmt = stmt.where(Game.name.ilike(f"%{search}%"))
    if platform_ids:
        # The platform of the user's *owned/wishlisted copy* (library_items), not
        # game_platforms — IGDB's full list of platforms a game was ever released on.
        clause = _match_values(
            lambda ids: exists().where(LibraryItem.game_id == Game.id, LibraryItem.platform_id.in_(ids)),
            platform_ids,
            platform_match_all,
        )
        stmt = stmt.where(_maybe_negate(clause, platform_exclude))
    if tag_ids:
        clause = _match_values(
            lambda ids: exists().where(GameTag.game_id == Game.id, GameTag.tag_id.in_(ids)),
            tag_ids,
            tag_match_all,
        )
        stmt = stmt.where(_maybe_negate(clause, tag_exclude))
    if categories:
        # No "match all" here: a game has exactly one category, so "all of two" could never
        # match. No need to also validate against _BROWSABLE_CATEGORIES here — list_top_level_games'
        # own base .where() already restricts every row to that set (or NULL) before this
        # runs, so an out-of-range value here would just AND down to zero rows rather than
        # leaking a non-browsable category. The addons queries have no such base restriction,
        # but addons are never browsable-category anyway, so the same reasoning holds.
        stmt = stmt.where(_maybe_negate(Game.category.in_(categories), category_exclude))
    if collection_ids:
        clause = _match_values(
            lambda ids: exists().where(GameCollection.game_id == Game.id, GameCollection.collection_id.in_(ids)),
            collection_ids,
            collection_match_all,
        )
        stmt = stmt.where(_maybe_negate(clause, collection_exclude))
    if franchise_ids:
        clause = _match_values(
            lambda ids: exists().where(GameFranchise.game_id == Game.id, GameFranchise.franchise_id.in_(ids)),
            franchise_ids,
            franchise_match_all,
        )
        stmt = stmt.where(_maybe_negate(clause, franchise_exclude))
    if formats:
        # Same "does this game have *any* library copy matching" shape as platform_ids above
        # — an independent exists() subquery, not correlated to the platform/storefront
        # filters' own matched row.
        clause = _match_values(
            lambda values: exists().where(LibraryItem.game_id == Game.id, LibraryItem.format.in_(values)),
            formats,
            format_match_all,
        )
        stmt = stmt.where(_maybe_negate(clause, format_exclude))
    if storefronts:
        clause = _match_values(
            lambda values: exists().where(LibraryItem.game_id == Game.id, LibraryItem.digital_storefront.in_(values)),
            storefronts,
            storefront_match_all,
        )
        stmt = stmt.where(_maybe_negate(clause, storefront_exclude))
    if play_statuses:
        clause = _match_values(_play_status_clause, play_statuses, play_status_match_all)
        stmt = stmt.where(_maybe_negate(clause, play_status_exclude))
    if steelbook_only:
        # A plain presence check, unlike the list-based filters above — no Exclude toggle,
        # since "not a Steelbook" isn't a meaningful thing to filter for on its own.
        stmt = stmt.where(exists().where(LibraryItem.game_id == Game.id, LibraryItem.steelbook.is_(True)))
    if sources:
        # No "match all", same as categories: a game is either IGDB-backed or custom, never both.
        clause = or_(
            *(Game.igdb_id.is_not(None) if source == GameSource.IGDB else Game.igdb_id.is_(None) for source in sources)
        )
        stmt = stmt.where(_maybe_negate(clause, source_exclude))
    return stmt.order_by(*_order_by_for_sort(sort))


def list_top_level_games(
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
    required_collection_id: int | None = None,
    required_franchise_id: int | None = None,
    required_platform_id: int | None = None,
    required_platform_format: MediaFormat | None = None,
    required_platform_storefront: str | None = None,
) -> list[GameWithStatus]:
    stmt = select(
        Game,
        _owned_exists(Game.id),
        _wishlisted_exists(Game.id),
        _play_status_subquery(Game.id),
        Game.user_rating,
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
    # A Platform page: games with a library copy on this platform (the same "your copy" rule
    # as the platform_ids filter, not IGDB's game_platforms release list) — for a PC storefront
    # card, only copies in that format/storefront.
    if required_platform_id is not None:
        stmt = stmt.where(
            platform_copy_exists(Game.id, required_platform_id, required_platform_format, required_platform_storefront)
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
            Game.user_rating,
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
            Game.user_rating,
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
            Game.user_rating,
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
            Game.user_rating,
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
    # Your rating lives on the game row itself: the target keeps its own, else takes source's.
    if target.user_rating is None:
        target.user_rating = source.user_rating
    # Source's IGDB Import match goes with it (target is linked, so has none to keep).
    db.execute(delete(IgdbImportEntry).where(IgdbImportEntry.game_id == source.id))
    db.delete(source)
    db.flush()


def delete_game_with_addons(db: Session, game: Game) -> list[str]:
    """Deletes the game, its addons, and every row that hangs off either: library_items
    (and their rom_files), game_progress, play_sessions, notes, game_tags, plus the
    catalog-richness tables populated at import/resync time (genres/companies/franchises/
    collections/platforms/screenshots/artworks/videos/release_dates).

    Returns the stored filenames of every deleted ROM and its save states/in-game save, for
    the caller to remove from disk (rom_service.delete_files) once its transaction commits."""
    addon_ids = list(db.scalars(select(Game.id).where(Game.parent_game_id == game.id)))
    return _delete_games(db, [game.id, *addon_ids])


def delete_addons(db: Session, game: Game) -> list[str]:
    """Deletes the game's addons (not the game itself) and everything that hangs off them,
    like delete_game_with_addons — for Change IGDB link / Unlink from IGDB, where the addons
    came from the old link. Returns their ROM filenames for the caller to remove from disk."""
    addon_ids = list(db.scalars(select(Game.id).where(Game.parent_game_id == game.id)))
    return _delete_games(db, addon_ids) if addon_ids else []


def _delete_games(db: Session, game_ids: list[int]) -> list[str]:
    item_ids = select(LibraryItem.id).where(LibraryItem.game_id.in_(game_ids))
    rom_ids = select(RomFile.id).where(RomFile.library_item_id.in_(item_ids))
    rom_filenames: list[str] = []
    for stored, sram in db.execute(
        select(RomFile.stored_filename, RomFile.sram_stored_filename).where(RomFile.id.in_(rom_ids))
    ):
        rom_filenames.extend(f for f in (stored, sram) if f)
    for stored, screenshot in db.execute(
        select(RomSaveState.stored_filename, RomSaveState.screenshot_filename).where(
            RomSaveState.rom_file_id.in_(rom_ids)
        )
    ):
        rom_filenames.extend(f for f in (stored, screenshot) if f)
    db.execute(delete(RomSaveState).where(RomSaveState.rom_file_id.in_(rom_ids)))
    db.execute(delete(RomFile).where(RomFile.library_item_id.in_(item_ids)))
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
    db.execute(delete(IgdbImportEntry).where(IgdbImportEntry.game_id.in_(game_ids)))
    db.execute(delete(Game).where(Game.id.in_(game_ids)))
    return rom_filenames
