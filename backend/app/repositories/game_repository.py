import enum
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal

from sqlalchemy import ColumnElement, Select, and_, case, delete, exists, false, func, or_, select, true, update
from sqlalchemy.orm import Session, aliased, joinedload, selectinload

from app.core.search_keys import search_key
from app.models.catalog import (
    Artwork,
    Game,
    GameAddonLink,
    GameAlternativeName,
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
from app.models.gog import GogDownload, GogLibraryEntry, GogWishlistEntry
from app.models.igdb_import import IgdbImportEntry
from app.models.labs import LAB_LINKED_ADDONS, LabFeature
from app.models.library import (
    GameDocument,
    GameProgress,
    GameTag,
    LibraryItem,
    LibraryStatus,
    MediaFormat,
    Note,
    PhysicalContents,
    PlaySession,
    PlayStatus,
    RomFile,
    RomSaveState,
)
from app.repositories import toys_to_life_repository
from app.services.document_files import GUIDE_STORE

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
    # On the Games list with Include add-ons: listed only because one of its add-ons matched.
    matched_via_addon: bool = False
    # In a game's Add-ons or an add-on's Works with: there through a manual link
    # (game_addon_links) rather than IGDB's parent_game_id.
    manual_link: bool = False
    # Same lists: the add-on is marked Included in that game (game_addon_links.included).
    included: bool = False
    # Same lists: the add-on is a pre-order bonus for that game (a label only).
    preorder_bonus: bool = False
    # A game's Add-ons: Included only through a pack Included in the game (Hot Wheels inside the
    # Expansions Bundle that comes with FH5 Premium); the pack it came through.
    included_via: "Game | None" = None


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


def _not_missing() -> ColumnElement[bool]:
    """Not a "Missing" game: one a Collection/Series resync discovered (Game.auto_discovered)
    that you haven't added, owned or wishlisted since. Those only exist to show what a series
    is missing, so only the Collection/Series pages list them; every other list, count and
    the public share page leave them out."""
    return or_(~Game.auto_discovered, _owned_exists(Game.id), _wishlisted_exists(Game.id))


def is_missing(status: GameWithStatus) -> bool:
    """Python-side twin of _not_missing (negated), for a game already loaded with its status."""
    return status.game.auto_discovered and not status.owned and not status.wishlisted


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


def _linked_addons_lab_on() -> ColumnElement[bool]:
    """Whether the Linked Add-ons lab is on, checked in SQL: while it's off, manual links stay
    stored but count nowhere (a game's Add-ons, the Include add-ons filters)."""
    return exists().where(LabFeature.id == LAB_LINKED_ADDONS, LabFeature.enabled.is_(True))


def _stored_linked_addon_ids(game_id: Any) -> Select[tuple[int]]:
    """Every add-on manually linked to a game, lab on or off: what deletes and the link
    endpoints themselves go by, so turning the lab off never loses data."""
    return select(GameAddonLink.addon_game_id).where(GameAddonLink.game_id == game_id)


def _linked_addon_ids(game_id: Any) -> Select[tuple[int]]:
    """The add-ons manually linked to a game (game_addon_links), next to its IGDB ones; none
    while the Linked Add-ons lab is off."""
    return select(GameAddonLink.addon_game_id).where(GameAddonLink.game_id == game_id, _linked_addons_lab_on())


# Add-ons that can hold other add-ons: a Season Pass, an Ultimate Pack. IGDB leaves these out
# (they'd repeat the add-ons they bundle), so they're custom add-ons with the Pack category.
PACK_CATEGORY = GameCategory.PACK
_ADDON_CATEGORIES = (GameCategory.DLC_ADDON, GameCategory.EXPANSION, GameCategory.PACK)


def _addon_game_ids() -> Select[tuple[int]]:
    return select(Game.id).where(Game.category.in_(_ADDON_CATEGORIES))


def _inherited_closure(name: str, status: LibraryStatus, *, packs_only: bool) -> Any:
    """The add-ons that take a status from something holding them (Linked Add-ons lab on): each
    add-on Included in something with that status, then everything Included in those, at any
    depth (FH5 Premium owned -> its Expansions Bundle -> the Hot Wheels expansion inside it).
    Only the inherited ones, so it stays small whatever the library's size; UNION (not UNION
    ALL) stops a loop of marks from recursing forever. packs_only: pass it on through packs
    only, not games."""
    holder_ok = GameAddonLink.game_id.in_(_addon_game_ids()) if packs_only else true()
    closure = (
        select(GameAddonLink.addon_game_id.label("game_id"))
        .join(LibraryItem, LibraryItem.game_id == GameAddonLink.game_id)
        .where(LibraryItem.status == status, GameAddonLink.included.is_(True), holder_ok, _linked_addons_lab_on())
        .cte(name, recursive=True)
    )
    return closure.union(
        select(GameAddonLink.addon_game_id)
        .join(closure, GameAddonLink.game_id == closure.c.game_id)
        .where(GameAddonLink.included.is_(True), holder_ok, _linked_addons_lab_on())
    )


# One shared CTE object each: two separate ones with the same name in a statement would clash.
_INHERITED_OWNED = _inherited_closure("inherited_owned", LibraryStatus.OWNED, packs_only=False)
# A wishlisted pack wishlists what's inside it; a wishlisted game doesn't.
_INHERITED_WISHLISTED = _inherited_closure("inherited_wishlisted", LibraryStatus.WISHLIST, packs_only=True)


def effective_owned(game_id_column: ColumnElement[int]) -> ColumnElement[bool]:
    """Owned: a copy of its own, or (an add-on) Included in something owned, through any number
    of packs."""
    return or_(_owned_exists(game_id_column), game_id_column.in_(select(_INHERITED_OWNED.c.game_id)))


def effective_wishlisted(game_id_column: ColumnElement[int]) -> ColumnElement[bool]:
    """Wishlisted: on the wishlist itself, or (not owned) inside a wishlisted pack."""
    return or_(
        _wishlisted_exists(game_id_column),
        and_(
            game_id_column.in_(select(_INHERITED_WISHLISTED.c.game_id)),
            ~effective_owned(game_id_column),
        ),
    )


def owned_via(db: Session, addon_id: int) -> list[Game]:
    """What an add-on is Included in that counts as owned (a game, or a pack owned itself or
    through a game), by name — its page's "Owned via"."""
    stmt = (
        select(Game)
        .join(GameAddonLink, GameAddonLink.game_id == Game.id)
        .where(
            GameAddonLink.addon_game_id == addon_id,
            GameAddonLink.included.is_(True),
            effective_owned(Game.id),
            _linked_addons_lab_on(),
        )
        .order_by(Game.name)
    )
    return list(db.scalars(stmt))


def wishlisted_via(db: Session, addon_id: int) -> list[Game]:
    """The wishlisted packs an add-on is inside (itself not owned) — its page's "Wishlisted
    via"."""
    stmt = (
        select(Game)
        .join(GameAddonLink, GameAddonLink.game_id == Game.id)
        .where(
            GameAddonLink.addon_game_id == addon_id,
            GameAddonLink.included.is_(True),
            Game.category.in_(_ADDON_CATEGORIES),
            effective_wishlisted(Game.id),
            ~effective_owned(GameAddonLink.addon_game_id),
            _linked_addons_lab_on(),
        )
        .order_by(Game.name)
    )
    return list(db.scalars(stmt))


# How an add-on goes with a game: works with it, Included in it, or a pre-order bonus for it.
AddonRelation = Literal["works_with", "included", "preorder_bonus"]


def relation_of(included: bool, preorder_bonus: bool) -> AddonRelation:
    return "included" if included else "preorder_bonus" if preorder_bonus else "works_with"


def _relation_select(*, addon_id: int | None = None, game_id: int | None = None) -> Select[Any]:
    links = GameAddonLink
    if addon_id is not None:
        return select(links.game_id, links.included, links.preorder_bonus).where(links.addon_game_id == addon_id)
    return select(links.addon_game_id, links.included, links.preorder_bonus).where(links.game_id == game_id)


def _relation_map(db: Session, *, addon_id: int | None = None, game_id: int | None = None) -> dict[int, AddonRelation]:
    """The relations on one side of the links: game id -> relation for an add-on, or add-on id ->
    relation for a game. Empty while the Linked Add-ons lab is off."""
    stmt = _relation_select(addon_id=addon_id, game_id=game_id).where(_linked_addons_lab_on())
    return {row[0]: relation_of(row[1], row[2]) for row in db.execute(stmt)}


def _row_to_game_with_status(row: Any) -> GameWithStatus:
    return GameWithStatus(
        game=row[0],
        owned=bool(row[1]),
        wishlisted=bool(row[2]),
        play_status=row[3],
        rating=row[4],
        matched_via_addon=bool(row[5]) if len(row) > 5 else False,
    )


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
    """Python-side twin of list_top_level_games' base .where(), minus _not_missing (which
    needs the game's copies): whether a loaded game's kind would appear on the main Games list."""
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


class ReleaseStatus(enum.Enum):
    """Released vs not out yet, by first_release_date against today. An IGDB game with no
    release date at all is still announced/TBA, so it counts as upcoming; a custom game with
    none simply wasn't given one, so it's neither."""

    RELEASED = "released"
    UPCOMING = "upcoming"


class GameSource(enum.Enum):
    """Where a game's metadata comes from — imported from IGDB, or added by hand via the
    manual game form (no igdb_id; shown with a "Custom" chip on its card)."""

    IGDB = "igdb"
    CUSTOM = "custom"


class ScreensaverFilter(enum.Enum):
    """The Games list's Screensaver filter (Screensaver lab): games shown in it, or hidden
    from it, by the per-game opt-out alone (Game.screensaver_excluded)."""

    SHOWN = "shown"
    HIDDEN = "hidden"


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


def name_matches(game: Any, search: str) -> ColumnElement[bool]:
    """Whether a game's name or one of its IGDB alternative names contains the search text,
    ignoring case, spaces, punctuation and accents: "gta 6" finds Grand Theft Auto VI through
    its "GTA 6" alternative name, and "gtav" finds "GTA V". Both sides are compared as search
    keys (app/core/search_keys.py), which also leaves no LIKE wildcards in the pattern. A
    query with no letters or digits at all (e.g. "+") falls back to a plain name match."""
    key = search_key(search)
    if not key:
        # Escaped, so a search for "%" or "_" means that character, not "anything".
        literal = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        return game.name.ilike(f"%{literal}%", escape="\\")
    pattern = f"%{key}%"
    return or_(
        game.search_key.like(pattern),
        exists().where(GameAlternativeName.game_id == game.id, GameAlternativeName.search_key.like(pattern)),
    )


def matched_alternative_names(db: Session, game_ids: list[int], search: str) -> dict[int, str]:
    """For games whose own name doesn't match the search, the first alternative name that
    does: game id → that name. Lets a result list say why "Grand Theft Auto VI" turned up
    for "gta 6"."""
    key = search_key(search)
    if not key or not game_ids:
        return {}
    pattern = f"%{key}%"
    rows = db.execute(
        select(GameAlternativeName.game_id, GameAlternativeName.name)
        .join(Game, Game.id == GameAlternativeName.game_id)
        .where(
            GameAlternativeName.game_id.in_(game_ids),
            GameAlternativeName.search_key.like(pattern),
            ~Game.search_key.like(pattern),
        )
        .order_by(GameAlternativeName.game_id, GameAlternativeName.id)
    )
    matches: dict[int, str] = {}
    for game_id, name in rows:
        matches.setdefault(game_id, name)
    return matches


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


def _platform_scope_clause(scopes: list[str], game: Any = Game) -> ColumnElement[bool]:
    """A Platforms-page card as a filter value: "<platform id>", or "<platform id>:<format>:
    <storefront>" for a PC storefront card (PC · Steam, PC · GOG, ...) — the same copy rule as
    that card's own page (platform_copy_exists), so the filter and the card always agree.
    `game` is Game itself or an aliased add-on (_GameFilters)."""
    clauses = []
    for scope in scopes:
        platform_id, _, rest = scope.partition(":")
        media_format, _, storefront = rest.partition(":")
        clauses.append(
            platform_copy_exists(
                game.id, int(platform_id), MediaFormat(media_format) if media_format else None, storefront or None
            )
        )
    return or_(*clauses)


def _release_status_clause(statuses: list[ReleaseStatus]) -> ColumnElement[bool]:
    now = int(datetime.now(UTC).timestamp())
    released = and_(Game.first_release_date.is_not(None), Game.first_release_date <= now)
    upcoming = or_(
        Game.first_release_date > now, and_(Game.first_release_date.is_(None), Game.igdb_id.is_not(None))
    )
    clauses = []
    if ReleaseStatus.RELEASED in statuses:
        clauses.append(released)
    if ReleaseStatus.UPCOMING in statuses:
        clauses.append(upcoming)
    return or_(*clauses)


def _year_start(year: int) -> int:
    return int(datetime(year, 1, 1, tzinfo=UTC).timestamp())


def _play_status_clause(statuses: list[PlayStatus], game: Any = Game) -> ColumnElement[bool]:
    """Matches when *any* of the game's platforms has one of these statuses, the same "any
    copy" rule the platform/format filters use, not the single priority-picked status a card
    shows (_play_status_subquery). NONE ("Not started") can't be a plain IN value: most
    unstarted games have no GameProgress row at all, so it means "no platform has a real
    status yet" instead. `game` is Game itself or an aliased add-on (_GameFilters)."""
    clauses = []
    started = [status for status in statuses if status != PlayStatus.NONE]
    if started:
        clauses.append(exists().where(GameProgress.game_id == game.id, GameProgress.play_status.in_(started)))
    if PlayStatus.NONE in statuses:
        clauses.append(~exists().where(GameProgress.game_id == game.id, GameProgress.play_status != PlayStatus.NONE))
    return or_(*clauses)


def _contents_clause(contents: list[PhysicalContents], game: Any = Game) -> ColumnElement[bool]:
    """Any *physical* copy with one of these contents — the same "any copy" rule as the
    format filter. Copies with no contents set never match."""
    return exists().where(
        LibraryItem.game_id == game.id,
        LibraryItem.format == MediaFormat.PHYSICAL,
        LibraryItem.physical_contents.in_(contents),
    )


# A condition on one game, given the game to test: Game itself, or an aliased add-on.
GameCondition = Callable[[Any], ColumnElement[bool]]


@dataclass
class _GameFilters:
    """The optional filters' clauses, built once for _apply_optional_game_filters' WHERE and,
    with include_addons, for the Games list's "Via add-on" flag (see game_matched_on_its_own).

    With include_addons, each *positive* condition is met by the game or by any of its add-ons
    (parent_game_id, or a manual link in game_addon_links), each one separately, so a search
    can match an add-on's name while the
    platform filter is met by the base game's copy. Exclude conditions, the game type and the
    Screensaver filter stay on the game itself: excluding never hides a game because of one of
    its add-ons."""

    include_addons: bool
    where: list[ColumnElement[bool]] = field(default_factory=list)
    # The positive conditions as tested on the game alone, for the flag.
    own: list[ColumnElement[bool]] = field(default_factory=list)

    def _game_or_addon(self, condition: GameCondition) -> ColumnElement[bool]:
        if not self.include_addons:
            return condition(Game)
        addon = aliased(Game)
        return or_(
            condition(Game),
            exists().where(
                or_(addon.parent_game_id == Game.id, addon.id.in_(_linked_addon_ids(Game.id))), condition(addon)
            ),
        )

    def positive(self, conditions: list[GameCondition]) -> None:
        """One filter's condition(s), ANDed: a single one for "any of these", one per value
        for "all of these", so each value can be met by a different item."""
        self.where.append(and_(*(self._game_or_addon(condition) for condition in conditions)))
        self.own.append(and_(*(condition(Game) for condition in conditions)))

    def on_game_only(self, clause: ColumnElement[bool]) -> None:
        self.where.append(clause)

    def values(
        self,
        build: Callable[[list[Any], Any], ColumnElement[bool]],
        values: list[Any],
        match_all: bool,
        exclude: bool,
    ) -> None:
        """A list filter with its Any/All choice (_match_values) and Exclude (_maybe_negate)."""
        if exclude:
            self.on_game_only(_maybe_negate(_match_values(lambda chosen: build(chosen, Game), values, match_all), True))
            return
        groups = [[value] for value in values] if match_all and len(values) > 1 else [values]
        self.positive([lambda game, chosen=chosen: build(chosen, game) for chosen in groups])


def _game_filters(
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
    contents: list[PhysicalContents] | None = None,
    contents_exclude: bool = False,
    contents_match_all: bool = False,
    sources: list[GameSource] | None = None,
    source_exclude: bool = False,
    screensaver: ScreensaverFilter | None = None,
    platform_scopes: list[str] | None = None,
    genre_ids: list[int] | None = None,
    genre_exclude: bool = False,
    genre_match_all: bool = False,
    release_statuses: list[ReleaseStatus] | None = None,
    release_year_from: int | None = None,
    release_year_to: int | None = None,
    local_players_min: int | None = None,
    online_multiplayer_only: bool = False,
    coop_only: bool = False,
    time_to_beat_min: int | None = None,
    time_to_beat_max: int | None = None,
    rating_min: int | None = None,
    include_addons: bool = False,
) -> _GameFilters:
    filters = _GameFilters(include_addons=include_addons)
    if search:
        filters.positive([lambda game: name_matches(game, search)])
    if platform_ids:
        # The platform of the user's *owned/wishlisted copy* (library_items), not
        # game_platforms — IGDB's full list of platforms a game was ever released on.
        filters.values(
            lambda ids, game: exists().where(LibraryItem.game_id == game.id, LibraryItem.platform_id.in_(ids)),
            platform_ids,
            platform_match_all,
            platform_exclude,
        )
    if tag_ids:
        filters.values(
            lambda ids, game: exists().where(GameTag.game_id == game.id, GameTag.tag_id.in_(ids)),
            tag_ids,
            tag_match_all,
            tag_exclude,
        )
    if categories:
        # No "match all": a game has exactly one category, so "all of two" could never match.
        # Always the listed game's own type, never an add-on's (add-ons are never browsable
        # types anyway). No need to also validate against _BROWSABLE_CATEGORIES here —
        # list_top_level_games' own base .where() already restricts every row to that set (or
        # NULL), so an out-of-range value just ANDs down to zero rows.
        filters.on_game_only(_maybe_negate(Game.category.in_(categories), category_exclude))
    if collection_ids:
        filters.values(
            lambda ids, game: exists().where(GameCollection.game_id == game.id, GameCollection.collection_id.in_(ids)),
            collection_ids,
            collection_match_all,
            collection_exclude,
        )
    if franchise_ids:
        filters.values(
            lambda ids, game: exists().where(GameFranchise.game_id == game.id, GameFranchise.franchise_id.in_(ids)),
            franchise_ids,
            franchise_match_all,
            franchise_exclude,
        )
    if formats:
        # Same "does this game have *any* library copy matching" shape as platform_ids above
        # — an independent exists() subquery, not correlated to the platform/storefront
        # filters' own matched row.
        filters.values(
            lambda values, game: exists().where(LibraryItem.game_id == game.id, LibraryItem.format.in_(values)),
            formats,
            format_match_all,
            format_exclude,
        )
    if storefronts:
        filters.values(
            lambda values, game: exists().where(
                LibraryItem.game_id == game.id, LibraryItem.digital_storefront.in_(values)
            ),
            storefronts,
            storefront_match_all,
            storefront_exclude,
        )
    if play_statuses:
        filters.values(_play_status_clause, play_statuses, play_status_match_all, play_status_exclude)
    if steelbook_only:
        # A plain presence check, unlike the list-based filters above — no Exclude toggle,
        # since "not a Steelbook" isn't a meaningful thing to filter for on its own.
        filters.positive([lambda game: exists().where(LibraryItem.game_id == game.id, LibraryItem.steelbook.is_(True))])
    if contents:
        filters.values(_contents_clause, contents, contents_match_all, contents_exclude)
    if sources:
        # No "match all", same as categories: a game is either IGDB-backed or custom, never both.
        def source_clause(chosen: list[GameSource], game: Any) -> ColumnElement[bool]:
            return or_(*(game.igdb_id.is_not(None) if s == GameSource.IGDB else game.igdb_id.is_(None) for s in chosen))

        filters.values(source_clause, sources, False, source_exclude)
    if screensaver is not None:
        filters.on_game_only(Game.screensaver_excluded.is_(screensaver == ScreensaverFilter.HIDDEN))
    if platform_scopes:
        # Shares the Platforms filter's Exclude/All toggles: it's the same field in the dialog,
        # just able to tell PC storefronts apart. Like platform_ids, an add-on's copy can meet it.
        filters.values(_platform_scope_clause, platform_scopes, platform_match_all, platform_exclude)
    if genre_ids:
        filters.values(
            lambda ids, game: exists().where(GameGenre.game_id == game.id, GameGenre.genre_id.in_(ids)),
            genre_ids,
            genre_match_all,
            genre_exclude,
        )
    # The rest describe the game itself (when it came out, how it plays, how long it is, how
    # it's rated), so they stay on the listed game even with Include add-ons: an add-on's own
    # release date or rating shouldn't decide whether its base game is listed.
    if release_statuses:
        # No "match all": a game is either out or not.
        filters.on_game_only(_release_status_clause(release_statuses))
    if release_year_from is not None:
        filters.on_game_only(Game.first_release_date >= _year_start(release_year_from))
    if release_year_to is not None:
        filters.on_game_only(Game.first_release_date < _year_start(release_year_to + 1))
    # The IGDB-backed columns below are NULL when IGDB has no data, and a NULL never satisfies
    # a comparison — so each of these filters only keeps games IGDB actually knows about.
    if local_players_min is not None:
        filters.on_game_only(Game.local_players >= local_players_min)
    if online_multiplayer_only:
        filters.on_game_only(Game.online_multiplayer.is_(True))
    if coop_only:
        filters.on_game_only(Game.coop.is_(True))
    if time_to_beat_min is not None:
        filters.on_game_only(Game.time_to_beat_main >= time_to_beat_min * 3600)
    if time_to_beat_max is not None:
        filters.on_game_only(Game.time_to_beat_main < time_to_beat_max * 3600)
    if rating_min is not None:
        filters.on_game_only(Game.igdb_rating >= rating_min)
    return filters


def _apply_optional_game_filters(
    stmt: Select[Any],
    *,
    sort: GameSortOption = GameSortOption.NAME_ASC,
    **filters: Any,
) -> Select[Any]:
    """The Games list's whole optional filter set (search + every filter dimension + sort; see
    _game_filters for the keywords), factored out of list_top_level_games so the
    Collection/Series "Addons" queries (collection_repository.list_addons_for_collection /
    franchise_repository.list_addons_for_franchise), Insights and the Game Shelf can offer the
    exact same filters against a differently-scoped base query, with zero duplicated
    clause-building logic to drift out of sync."""
    return stmt.where(*_game_filters(**filters).where).order_by(*_order_by_for_sort(sort))


def game_matched_on_its_own(**filters: Any) -> ColumnElement[bool]:
    """Whether the listed game meets every positive filter by itself, without its add-ons. With
    Include add-ons, a game in the results where this is false is there because of an add-on
    (the Games list's "Via add-on" chip)."""
    own = _game_filters(**filters).own
    return and_(*own) if own else true()


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
    contents: list[PhysicalContents] | None = None,
    contents_exclude: bool = False,
    contents_match_all: bool = False,
    sources: list[GameSource] | None = None,
    source_exclude: bool = False,
    screensaver: ScreensaverFilter | None = None,
    platform_scopes: list[str] | None = None,
    genre_ids: list[int] | None = None,
    genre_exclude: bool = False,
    genre_match_all: bool = False,
    release_statuses: list[ReleaseStatus] | None = None,
    release_year_from: int | None = None,
    release_year_to: int | None = None,
    local_players_min: int | None = None,
    online_multiplayer_only: bool = False,
    coop_only: bool = False,
    time_to_beat_min: int | None = None,
    time_to_beat_max: int | None = None,
    rating_min: int | None = None,
    include_addons: bool = False,
    sort: GameSortOption = GameSortOption.NAME_ASC,
    required_collection_id: int | None = None,
    required_franchise_id: int | None = None,
    required_platform_id: int | None = None,
    required_platform_format: MediaFormat | None = None,
    required_platform_storefront: str | None = None,
    include_missing: bool = False,
) -> list[GameWithStatus]:
    filter_values = {
        "search": search,
        "platform_ids": platform_ids,
        "platform_exclude": platform_exclude,
        "platform_match_all": platform_match_all,
        "tag_ids": tag_ids,
        "tag_exclude": tag_exclude,
        "tag_match_all": tag_match_all,
        "collection_ids": collection_ids,
        "collection_exclude": collection_exclude,
        "collection_match_all": collection_match_all,
        "franchise_ids": franchise_ids,
        "franchise_exclude": franchise_exclude,
        "franchise_match_all": franchise_match_all,
        "categories": categories,
        "category_exclude": category_exclude,
        "formats": formats,
        "format_exclude": format_exclude,
        "format_match_all": format_match_all,
        "storefronts": storefronts,
        "storefront_exclude": storefront_exclude,
        "storefront_match_all": storefront_match_all,
        "play_statuses": play_statuses,
        "play_status_exclude": play_status_exclude,
        "play_status_match_all": play_status_match_all,
        "steelbook_only": steelbook_only,
        "contents": contents,
        "contents_exclude": contents_exclude,
        "contents_match_all": contents_match_all,
        "sources": sources,
        "source_exclude": source_exclude,
        "screensaver": screensaver,
        "platform_scopes": platform_scopes,
        "genre_ids": genre_ids,
        "genre_exclude": genre_exclude,
        "genre_match_all": genre_match_all,
        "release_statuses": release_statuses,
        "release_year_from": release_year_from,
        "release_year_to": release_year_to,
        "local_players_min": local_players_min,
        "online_multiplayer_only": online_multiplayer_only,
        "coop_only": coop_only,
        "time_to_beat_min": time_to_beat_min,
        "time_to_beat_max": time_to_beat_max,
        "rating_min": rating_min,
        "include_addons": include_addons,
    }
    # "Via add-on": in the results only because of an add-on (see _GameFilters).
    via_addon = ~game_matched_on_its_own(**filter_values) if include_addons else false()
    stmt = select(
        Game,
        _owned_exists(Game.id),
        _wishlisted_exists(Game.id),
        _play_status_subquery(Game.id),
        Game.user_rating,
        via_addon,
    ).where(Game.parent_game_id.is_(None), _is_browsable_game(Game.category))
    if not include_missing:
        stmt = stmt.where(_not_missing())
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
    stmt = _apply_optional_game_filters(stmt, sort=sort, **filter_values)
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]


@dataclass(frozen=True)
class ShelfGame:
    id: int
    uuid: str
    slug: str | None
    name: str


@dataclass(frozen=True)
class ShelfCopy:
    game_id: int
    platform_id: int
    format: MediaFormat | None
    digital_storefront: str | None
    steelbook: bool
    physical_contents: PhysicalContents | None = None


def list_shelf_games(db: Session, **filters: Any) -> list[ShelfGame]:
    """The Game Shelf's games: top-level browsable games with an owned copy, filtered and
    sorted exactly like the Games list (same _apply_optional_game_filters), but only the
    columns a spine needs."""
    stmt = select(Game.id, Game.uuid, Game.slug, Game.name).where(
        Game.parent_game_id.is_(None),
        _is_browsable_game(Game.category),
        _owned_exists(Game.id),
    )
    stmt = _apply_optional_game_filters(stmt, **filters)
    return [ShelfGame(*row) for row in db.execute(stmt)]


def list_owned_copies(db: Session, game_ids: list[int]) -> list[ShelfCopy]:
    """Every owned, platform-assigned copy of these games, in id order (oldest copy first)."""
    if not game_ids:
        return []
    stmt = (
        select(
            LibraryItem.game_id,
            LibraryItem.platform_id,
            LibraryItem.format,
            LibraryItem.digital_storefront,
            LibraryItem.steelbook,
            LibraryItem.physical_contents,
        )
        .where(
            LibraryItem.game_id.in_(game_ids),
            LibraryItem.status == LibraryStatus.OWNED,
            LibraryItem.platform_id.is_not(None),
        )
        .order_by(LibraryItem.id)
    )
    return [ShelfCopy(*row) for row in db.execute(stmt)]


@dataclass(frozen=True)
class ScreensaverGame:
    id: int
    uuid: str
    slug: str | None
    name: str
    cover_url: str


@dataclass(frozen=True)
class ScreensaverShows:
    """Settings → Screensaver → What to show. At least one of owned/wishlist is on (the
    preferences route enforces it); custom is separate."""

    owned: bool = True
    wishlist: bool = False
    custom: bool = True


def _screensaver_filter(shows: ScreensaverShows) -> ColumnElement[bool]:
    """The Screensaver lab's games: top-level browsable games you own a copy of and/or have
    wishlisted (per `shows`; either also means it isn't Missing), with a cover, that you
    haven't opted out, and, unless custom games are included, imported from IGDB."""
    groups = [
        clause
        for wanted, clause in ((shows.owned, _owned_exists(Game.id)), (shows.wishlist, _wishlisted_exists(Game.id)))
        if wanted
    ]
    conditions = [
        Game.parent_game_id.is_(None),
        _is_browsable_game(Game.category),
        # Nothing chosen can't happen through the API; it shows nothing rather than everything.
        or_(*groups) if groups else false(),
        Game.cover_url.is_not(None),
        Game.cover_url != "",
        ~Game.screensaver_excluded,
    ]
    if not shows.custom:
        conditions.append(Game.igdb_id.is_not(None))
    return and_(*conditions)


def count_screensaver_games(db: Session, shows: ScreensaverShows) -> int:
    return db.scalar(select(func.count()).select_from(Game).where(_screensaver_filter(shows))) or 0


def sample_screensaver_games(db: Session, limit: int, shows: ScreensaverShows) -> list[ScreensaverGame]:
    """Up to `limit` of the screensaver's games in random order, picked by the database, so a
    large library never loads more than a slide show's worth of rows."""
    stmt = (
        select(Game.id, Game.uuid, Game.slug, Game.name, Game.cover_url)
        .where(_screensaver_filter(shows))
        .order_by(func.random())
        .limit(limit)
    )
    return [ScreensaverGame(*row) for row in db.execute(stmt)]


def set_screensaver_excluded(db: Session, game_ids: list[int], excluded: bool) -> int:
    """Opts these games out of (or back into) the screensaver; returns how many exist. Unknown
    ids are skipped. Not committed."""
    if not game_ids:
        return 0
    result = db.execute(update(Game).where(Game.id.in_(game_ids)).values(screensaver_excluded=excluded))
    return result.rowcount or 0


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
        selectinload(Game.alternative_names),
    )


def get_game(db: Session, game_id: int) -> GameWithStatus | None:
    stmt = _status_select().options(*_get_game_options()).where(Game.id == game_id)
    row = db.execute(stmt).first()
    if row is None:
        return None
    return _row_to_game_with_status(row)


def get_game_by_uuid(db: Session, game_uuid: str) -> GameWithStatus | None:
    stmt = _status_select().options(*_get_game_options()).where(Game.uuid == game_uuid)
    row = db.execute(stmt).first()
    return _row_to_game_with_status(row) if row else None


def get_game_by_slug(db: Session, slug: str) -> GameWithStatus | None:
    stmt = _status_select().options(*_get_game_options()).where(Game.slug == slug)
    row = db.execute(stmt).first()
    return _row_to_game_with_status(row) if row else None


def get_game_by_igdb_id(db: Session, igdb_id: int) -> Game | None:
    return db.scalars(select(Game).where(Game.igdb_id == igdb_id)).first()


def games_by_igdb_ids(db: Session, igdb_ids: list[int]) -> dict[int, Game]:
    if not igdb_ids:
        return {}
    return {game.igdb_id: game for game in db.scalars(select(Game).where(Game.igdb_id.in_(igdb_ids)))}


def list_igdb_linked_games(db: Session) -> list[tuple[int, str]]:
    """(id, name) pairs for every game with an igdb_id — the set a bulk resync job (see
    app/services/resync_collections_job.py) iterates. Manually-added games have no igdb_id
    to resync from (see game_service.resync_game) and are excluded."""
    stmt = select(Game.id, Game.name).where(Game.igdb_id.is_not(None)).order_by(Game.id)
    return [(row[0], row[1]) for row in db.execute(stmt)]


def _status_select() -> Select[Any]:
    return select(
        Game,
        effective_owned(Game.id),
        effective_wishlisted(Game.id),
        _play_status_subquery(Game.id),
        Game.user_rating,
    )


def list_addons(db: Session, parent_game_id: int) -> list[GameWithStatus]:
    """A game's add-ons: IGDB's (parent_game_id) and the ones manually linked to it, flagged
    manual_link, plus (lab on) the contents of any pack Included in it, flagged included_via
    that pack; all sorted by name together."""
    stmt = (
        _status_select()
        # A Toys-to-Life pack has its own page; its IGDB add-on row stays hidden.
        .where(
            or_(Game.parent_game_id == parent_game_id, Game.id.in_(_linked_addon_ids(parent_game_id))),
            ~toys_to_life_repository.is_toy_pack(Game.igdb_id),
        )
    )
    addons = {status.game.id: status for status in map(_row_to_game_with_status, db.execute(stmt))}
    relations = _relation_map(db, game_id=parent_game_id)
    for addon in addons.values():
        addon.manual_link = addon.game.parent_game_id != parent_game_id
        _apply_relation(addon, relations.get(addon.game.id))
    via = _included_through_packs(db, [addon_id for addon_id, rel in relations.items() if rel == "included"])
    via.pop(parent_game_id, None)
    missing = [addon_id for addon_id in via if addon_id not in addons]
    if missing:
        stmt = _status_select().where(Game.id.in_(missing), ~toys_to_life_repository.is_toy_pack(Game.igdb_id))
        for status in map(_row_to_game_with_status, db.execute(stmt)):
            addons[status.game.id] = status
    # Every pack on the way is listed too (directly Included, or reached above).
    for addon_id, pack_id in via.items():
        addon = addons.get(addon_id)
        if addon is not None and not addon.included:
            addon.included = True
            pack = addons.get(pack_id)
            addon.included_via = pack.game if pack else None
    return sorted(addons.values(), key=lambda addon: addon.game.name)


def _pack_contents_map(db: Session, *, lab_gated: bool = True) -> dict[int, set[int]]:
    """Every pack's contents: container add-on id -> the add-ons Included in it."""
    stmt = select(GameAddonLink.game_id, GameAddonLink.addon_game_id).where(
        GameAddonLink.included.is_(True), GameAddonLink.game_id.in_(_addon_game_ids())
    )
    if lab_gated:
        stmt = stmt.where(_linked_addons_lab_on())
    contents: dict[int, set[int]] = {}
    for container_id, addon_id in db.execute(stmt):
        contents.setdefault(container_id, set()).add(addon_id)
    return contents


def _included_through_packs(db: Session, included_ids: list[int]) -> dict[int, int]:
    """The add-ons inside the packs among included_ids, at any depth: add-on id -> the pack it
    sits in directly (the first one found, breadth-first). Lab-gated like the marks themselves."""
    if not included_ids:
        return {}
    contents = _pack_contents_map(db)
    via: dict[int, int] = {}
    seen = set(included_ids)
    queue = list(included_ids)
    while queue:
        pack_id = queue.pop(0)
        for addon_id in sorted(contents.get(pack_id, ())):
            if addon_id not in seen:
                seen.add(addon_id)
                via[addon_id] = pack_id
                queue.append(addon_id)
    return via


def list_works_with(db: Session, addon: Game) -> list[GameWithStatus]:
    """The games an add-on belongs with: its IGDB parent first, then the games it's manually
    linked to (manual_link), by name. The packs it's in are list_packs_of's."""
    linked_ids = select(GameAddonLink.game_id).where(
        GameAddonLink.addon_game_id == addon.id, GameAddonLink.game_id.not_in(_addon_game_ids())
    )
    stmt = _status_select().where(Game.id.in_(linked_ids)).order_by(Game.name)
    if addon.parent_game_id is not None:
        # A resync can later make a linked game the IGDB parent too; list it once, as the parent.
        stmt = stmt.where(Game.id != addon.parent_game_id)
    rows = [_row_to_game_with_status(row) for row in db.execute(stmt)]
    for row in rows:
        row.manual_link = True
    if addon.parent_game_id is not None:
        parent = db.execute(_status_select().where(Game.id == addon.parent_game_id)).first()
        if parent is not None:
            rows.insert(0, _row_to_game_with_status(parent))
    relations = _relation_map(db, addon_id=addon.id)
    for row in rows:
        _apply_relation(row, relations.get(row.game.id))
    return rows


def _apply_relation(status: GameWithStatus, relation: AddonRelation | None) -> None:
    status.included = relation == "included"
    status.preorder_bonus = relation == "preorder_bonus"


# --- Packs ----------------------------------------------------------------------------------
# A pack (Season Pass, Ultimate Pack) holds other add-ons: a game_addon_links row whose "game"
# is the pack, always Included. Owning the pack, or a game it's Included in, owns its contents.


def list_pack_contents(db: Session, pack_id: int) -> list[GameWithStatus]:
    """The add-ons inside a pack, by name."""
    contents = select(GameAddonLink.addon_game_id).where(GameAddonLink.game_id == pack_id)
    stmt = _status_select().where(Game.id.in_(contents)).order_by(Game.name)
    rows = [_row_to_game_with_status(row) for row in db.execute(stmt)]
    for row in rows:
        row.included = True
    return rows


def list_packs_of(db: Session, addon_id: int) -> list[GameWithStatus]:
    """The packs an add-on is inside, by name."""
    packs = select(GameAddonLink.game_id).where(
        GameAddonLink.addon_game_id == addon_id, GameAddonLink.game_id.in_(_addon_game_ids())
    )
    stmt = _status_select().where(Game.id.in_(packs)).order_by(Game.name)
    rows = [_row_to_game_with_status(row) for row in db.execute(stmt)]
    for row in rows:
        row.included = True
    return rows


def pack_descendants(db: Session, pack_id: int) -> set[int]:
    """Everything inside a pack, at any depth (stored marks, lab on or off): what it can't be
    put inside without a loop."""
    contents = _pack_contents_map(db, lab_gated=False)
    found: set[int] = set()
    queue = [pack_id]
    while queue:
        for addon_id in contents.get(queue.pop(), ()):
            if addon_id not in found:
                found.add(addon_id)
                queue.append(addon_id)
    return found


def pack_ancestors(db: Session, addon_id: int) -> set[int]:
    """Every pack an add-on is inside, at any depth (stored marks, lab on or off)."""
    containers: dict[int, set[int]] = {}
    for pack_id, contents in _pack_contents_map(db, lab_gated=False).items():
        for content_id in contents:
            containers.setdefault(content_id, set()).add(pack_id)
    found: set[int] = set()
    queue = [addon_id]
    while queue:
        for pack_id in containers.get(queue.pop(), ()):
            if pack_id not in found:
                found.add(pack_id)
                queue.append(pack_id)
    return found


# --- Link and pack candidates: editions of the same game ------------------------------------
# A base game and the editions IGDB records as versions of it (Game.version_parent_igdb_id),
# e.g. Forza Horizon 5 and its Deluxe and Premium editions. The pickers offer only these.


def _is_top_level_game() -> ColumnElement[bool]:
    return and_(
        Game.parent_game_id.is_(None),
        or_(Game.category.is_(None), Game.category.not_in(_ADDON_CATEGORIES)),
    )


def edition_family(db: Session, game_ids: set[int]) -> set[int]:
    """game_ids plus every other edition of the same games in the library: those sharing a base
    game (version_parent, or the game itself when it is the base)."""
    if not game_ids:
        return set()
    root = func.coalesce(Game.version_parent_igdb_id, Game.igdb_id)
    roots = select(root).where(Game.id.in_(game_ids), Game.igdb_id.is_not(None))
    return set(game_ids) | set(db.scalars(select(Game.id).where(root.in_(roots), _is_top_level_game())))


def _own_games(db: Session, addon: Game) -> set[int]:
    """The games an add-on is for: its IGDB parent and the games it's manually linked to."""
    linked = db.scalars(
        select(GameAddonLink.game_id).where(
            GameAddonLink.addon_game_id == addon.id, GameAddonLink.game_id.not_in(_addon_game_ids())
        )
    )
    return {*linked, *([addon.parent_game_id] if addon.parent_game_id is not None else [])}


def _addons_of(db: Session, game_ids: set[int]) -> dict[int, int]:
    """Add-ons of any of game_ids, through IGDB's parent or a manual link: add-on id -> the game
    it's for (its parent when that's one of them)."""
    if not game_ids:
        return {}
    found: dict[int, int] = {}
    for addon_id, game_id in db.execute(
        select(GameAddonLink.addon_game_id, GameAddonLink.game_id).where(GameAddonLink.game_id.in_(game_ids))
    ):
        found.setdefault(addon_id, game_id)
    for addon_id, parent_id in db.execute(
        select(Game.id, Game.parent_game_id).where(
            Game.parent_game_id.in_(game_ids), Game.category.in_(_ADDON_CATEGORIES)
        )
    ):
        found[addon_id] = parent_id
    return found


def _candidate_statuses(
    db: Session, ids: Any, *conditions: ColumnElement[bool], search: str | None
) -> list[GameWithStatus]:
    stmt = _status_select().where(Game.id.in_(ids), _not_missing(), *conditions).order_by(Game.name)
    if search and search.strip():
        stmt = stmt.where(name_matches(Game, search))
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]


def _with_editions(
    db: Session, statuses: list[GameWithStatus], edition_of: dict[int, int]
) -> list[tuple[GameWithStatus, Game | None]]:
    """Each add-on with the edition it's for, by edition name then name."""
    games = {game.id: game for game in db.scalars(select(Game).where(Game.id.in_(set(edition_of.values()))))}
    pairs = [(status, games.get(edition_of.get(status.game.id, -1))) for status in statuses]
    return sorted(pairs, key=lambda pair: (pair[1].name if pair[1] else "", pair[0].game.name))


def list_link_candidates(
    db: Session, game: Game, *, is_addon: bool, search: str | None = None
) -> list[tuple[GameWithStatus, Game | None]]:
    """What the link picker offers, from the other editions of the same game. For an add-on:
    those editions (not its own IGDB parent). For a game: the other editions' add-ons, each with
    the edition it's for, minus the game's own IGDB add-ons and Toys-to-Life packs. Never
    Missing games."""
    if is_addon:
        family = edition_family(db, _own_games(db, game)) - {game.parent_game_id}
        statuses = _candidate_statuses(db, family, _is_top_level_game(), search=search)
        return [(status, None) for status in statuses]
    edition_of = _addons_of(db, edition_family(db, {game.id}) - {game.id})
    statuses = _candidate_statuses(
        db,
        set(edition_of),
        Game.category.in_(_ADDON_CATEGORIES),
        Game.parent_game_id.is_distinct_from(game.id),
        ~toys_to_life_repository.is_toy_pack(Game.igdb_id),
        search=search,
    )
    return _with_editions(db, statuses, edition_of)


def list_pack_candidates(
    db: Session, game: Game, *, packs: bool, search: str | None = None
) -> list[tuple[GameWithStatus, Game | None]]:
    """What a pack's picker offers, for the editions of the same games. packs=False (on a pack):
    add-ons to put inside it; packs=True (on an add-on): packs to put it in. Each with the
    edition it's for. Never Missing games or Toys-to-Life packs."""
    edition_of = _addons_of(db, edition_family(db, _own_games(db, game)))
    edition_of.pop(game.id, None)
    # Packs that can hold add-ons: custom ones, or any already holding some (see
    # addon_link_service.is_pack).
    holder = and_(
        Game.category == PACK_CATEGORY,
        or_(Game.igdb_id.is_(None), Game.id.in_(select(GameAddonLink.game_id))),
    )
    scope = holder if packs else Game.category.in_(_ADDON_CATEGORIES)
    statuses = _candidate_statuses(
        db, set(edition_of), scope, ~toys_to_life_repository.is_toy_pack(Game.igdb_id), search=search
    )
    return _with_editions(db, statuses, edition_of)


def pack_content_ids(db: Session, pack_id: int) -> set[int]:
    return set(db.scalars(select(GameAddonLink.addon_game_id).where(GameAddonLink.game_id == pack_id)))


def pack_ids_of(db: Session, addon_id: int) -> set[int]:
    return set(
        db.scalars(
            select(GameAddonLink.game_id).where(
                GameAddonLink.addon_game_id == addon_id, GameAddonLink.game_id.in_(_addon_game_ids())
            )
        )
    )


def linked_ids(db: Session, game_id: int, *, addon_side: bool) -> set[int]:
    """The other side of a game's manual links: for an add-on the games it's linked to, for a
    game the add-ons linked to it. A row for an add-on's own IGDB parent (only an Included mark)
    isn't a link and is left out."""
    if addon_side:
        parent_id = select(Game.parent_game_id).where(Game.id == game_id).scalar_subquery()
        stmt = select(GameAddonLink.game_id).where(
            GameAddonLink.addon_game_id == game_id, GameAddonLink.game_id.is_distinct_from(parent_id)
        )
        return set(db.scalars(stmt))
    own_addons = select(Game.id).where(Game.parent_game_id == game_id)
    return set(db.scalars(_stored_linked_addon_ids(game_id).where(GameAddonLink.addon_game_id.not_in(own_addons))))


def relation_map(db: Session, game_id: int, *, addon_side: bool) -> dict[int, AddonRelation]:
    """Every stored relation on one side, lab on or off (the link endpoints go by it)."""
    stmt = _relation_select(addon_id=game_id) if addon_side else _relation_select(game_id=game_id)
    return {row[0]: relation_of(row[1], row[2]) for row in db.execute(stmt)}


def _set_relation(link: GameAddonLink, relation: AddonRelation) -> None:
    link.included = relation == "included"
    link.preorder_bonus = relation == "preorder_bonus"


def add_addon_links(
    db: Session, pairs: list[tuple[int, int]], relations: dict[tuple[int, int], AddonRelation] | None = None
) -> int:
    """Adds (addon_game_id, game_id) links that don't exist yet, each with its relation from
    `relations` (works with when not given); an existing link takes a given Included or bonus
    relation too. Returns how many links were new."""
    if not pairs:
        return 0
    relations = relations or {}
    addon_ids = {addon_id for addon_id, _ in pairs}
    existing = {
        (link.addon_game_id, link.game_id): link
        for link in db.scalars(select(GameAddonLink).where(GameAddonLink.addon_game_id.in_(addon_ids)))
    }
    added = 0
    for pair in dict.fromkeys(pairs):
        relation = relations.get(pair, "works_with")
        link = existing.get(pair)
        if link is None:
            link = GameAddonLink(addon_game_id=pair[0], game_id=pair[1])
            _set_relation(link, relation)
            db.add(link)
            added += 1
        elif relation != "works_with":
            _set_relation(link, relation)
    db.flush()
    return added


def set_addon_relation(db: Session, addon_id: int, game_id: int, relation: AddonRelation, *, keep_row: bool) -> None:
    """Sets how a pair goes together. keep_row: the pair is a manual link, whose row stays either
    way; otherwise (the add-on's own IGDB parent) the row exists only while it carries a mark."""
    link = db.scalars(
        select(GameAddonLink).where(GameAddonLink.addon_game_id == addon_id, GameAddonLink.game_id == game_id)
    ).first()
    if link is None:
        if relation != "works_with":
            link = GameAddonLink(addon_game_id=addon_id, game_id=game_id)
            _set_relation(link, relation)
            db.add(link)
    elif relation != "works_with" or keep_row:
        _set_relation(link, relation)
    else:
        db.delete(link)
    db.flush()


@dataclass
class AddonLinkRow:
    addon: Game
    game: Game
    relation: AddonRelation
    # False for the add-on's own IGDB parent: only an Included mark, not a link to unlink.
    manual: bool
    # The "game" is a pack the add-on sits inside (always Included).
    pack: bool = False


def list_all_addon_links(db: Session) -> list[AddonLinkRow]:
    """Every link and Included mark, by add-on name then game name — Settings → Linked Add-ons'
    overview."""
    addon = aliased(Game)
    game = aliased(Game)
    stmt = (
        select(addon, game, GameAddonLink.included, GameAddonLink.preorder_bonus)
        .join(GameAddonLink, GameAddonLink.addon_game_id == addon.id)
        .join(game, game.id == GameAddonLink.game_id)
        .order_by(addon.name, game.name)
    )
    return [
        AddonLinkRow(
            addon=row[0],
            game=row[1],
            relation=relation_of(row[2], row[3]),
            manual=row[0].parent_game_id != row[1].id,
            pack=row[1].category in _ADDON_CATEGORIES,
        )
        for row in db.execute(stmt)
    ]


def remove_addon_link(db: Session, addon_id: int, game_id: int) -> bool:
    result = db.execute(
        delete(GameAddonLink).where(GameAddonLink.addon_game_id == addon_id, GameAddonLink.game_id == game_id)
    )
    return bool(result.rowcount)


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
    db.execute(update(GameDocument).where(GameDocument.game_id == source.id).values(game_id=target.id))
    db.execute(update(GameTag).where(GameTag.game_id == source.id).values(game_id=target.id))
    db.execute(update(Game).where(Game.parent_game_id == source.id).values(parent_game_id=target.id))
    _merge_addon_links(db, source.id, target.id)
    # Your rating lives on the game row itself: the target keeps its own, else takes source's.
    if target.user_rating is None:
        target.user_rating = source.user_rating
    # Source's IGDB Import match goes with it (target is linked, so has none to keep).
    db.execute(delete(IgdbImportEntry).where(IgdbImportEntry.game_id == source.id))
    # A GOG Sync match (owned or wishlist) follows the game, unless the target already has
    # one of its own in that table.
    for gog_model in (GogLibraryEntry, GogWishlistEntry):
        target_has_gog = db.scalar(select(exists().where(gog_model.game_id == target.id)))
        db.execute(
            update(gog_model)
            .where(gog_model.game_id == source.id)
            .values(game_id=None if target_has_gog else target.id)
        )
    db.execute(update(GogDownload).where(GogDownload.game_id == source.id).values(game_id=target.id))
    db.delete(source)
    db.flush()


def _merge_addon_links(db: Session, source_id: int, target_id: int) -> None:
    """merge_game's part for manual add-on links: source's move to target, on either side.
    Links target already has are dropped rather than duplicated, and so is any link that would
    now point an add-on at itself or at its own IGDB parent."""
    links = GameAddonLink
    db.execute(
        delete(links).where(
            links.addon_game_id == source_id,
            links.game_id.in_(select(links.game_id).where(links.addon_game_id == target_id)),
        )
    )
    db.execute(
        delete(links).where(
            links.game_id == source_id,
            links.addon_game_id.in_(select(links.addon_game_id).where(links.game_id == target_id)),
        )
    )
    db.execute(update(links).where(links.addon_game_id == source_id).values(addon_game_id=target_id))
    db.execute(update(links).where(links.game_id == source_id).values(game_id=target_id))
    db.execute(delete(links).where(links.addon_game_id == links.game_id))
    # A row for an add-on's own IGDB parent is only kept while it carries a mark.
    db.execute(
        delete(links).where(
            links.game_id == target_id,
            links.addon_game_id.in_(select(Game.id).where(Game.parent_game_id == target_id)),
            links.included.is_(False),
            links.preorder_bonus.is_(False),
        )
    )
    target_parent_id = db.scalar(select(Game.parent_game_id).where(Game.id == target_id))
    if target_parent_id is not None:
        db.execute(
            delete(links).where(
                links.addon_game_id == target_id,
                links.game_id == target_parent_id,
                links.included.is_(False),
                links.preorder_bonus.is_(False),
            )
        )


def image_urls(db: Session, game_ids: list[int]) -> list[str]:
    """Every cover, screenshot and artwork address these games use, for the caller to pass to
    upload_service.delete_if_local_upload once the rows are gone or replaced (that skips
    anything that isn't one of our own uploads, such as IGDB's images)."""
    if not game_ids:
        return []
    covers = db.scalars(select(Game.cover_url).where(Game.id.in_(game_ids), Game.cover_url.is_not(None)))
    screenshots = db.scalars(select(Screenshot.url).where(Screenshot.game_id.in_(game_ids)))
    artworks = db.scalars(select(Artwork.url).where(Artwork.game_id.in_(game_ids)))
    return [url for url in (*covers, *screenshots, *artworks) if url]


def addon_ids(db: Session, game_id: int) -> list[int]:
    return list(db.scalars(select(Game.id).where(Game.parent_game_id == game_id)))


@dataclass
class AddonRemoval:
    """What removing a game (or just its IGDB add-ons) does to add-ons, worked out up front so
    the delete confirmation can name the kept ones and the delete itself does the same."""

    # Go along: nothing outside the removal still holds them.
    deleted_ids: list[int]
    # Stay, detached from the removed parent: a manual link to a game that stays holds them.
    kept_ids: list[int]


def plan_addon_removal(db: Session, game_id: int, *, game_itself: bool = True) -> AddonRemoval:
    """For deleting a game (game_itself) or only its IGDB add-ons (Change IGDB link / Unlink
    from IGDB). The game's IGDB add-ons go with it, unless a manual link to another game
    holds them; those stay, detached. Deleting the game itself also deletes an add-on that
    was only held by a manual link to it and has no IGDB parent in your library, so it can't
    be left attached to nothing."""
    candidates = set(addon_ids(db, game_id))
    if game_itself:
        candidates |= set(db.scalars(_stored_linked_addon_ids(game_id)))
    if not candidates:
        return AddonRemoval(deleted_ids=[], kept_ids=[])
    rows = db.execute(select(Game.id, Game.parent_game_id).where(Game.id.in_(candidates))).all()
    # Only manually linked to this game; its own IGDB parent stays, and so does it.
    removable = {addon_id for addon_id, parent_id in rows if parent_id is None or parent_id == game_id}
    holders: dict[int, set[int]] = {}
    for addon_id, holder_id in db.execute(
        select(GameAddonLink.addon_game_id, GameAddonLink.game_id).where(
            GameAddonLink.addon_game_id.in_(removable), GameAddonLink.game_id != game_id
        )
    ):
        holders.setdefault(addon_id, set()).add(holder_id)
    # A link to something that goes too (a pack deleted along with the game) holds nothing, so
    # start with everything going and keep whatever a staying game or kept pack still holds.
    deleted = set(removable)
    changed = True
    while changed:
        changed = False
        for addon_id in sorted(deleted):
            if holders.get(addon_id, set()) - deleted:
                deleted.discard(addon_id)
                changed = True
    return AddonRemoval(deleted_ids=sorted(deleted), kept_ids=sorted(removable - deleted))


def _detach(db: Session, addon_ids: list[int]) -> None:
    if addon_ids:
        db.execute(update(Game).where(Game.id.in_(addon_ids)).values(parent_game_id=None))


def delete_game_with_addons(db: Session, game: Game) -> list[str]:
    """Deletes the game, its addons, and every row that hangs off either: library_items
    (and their rom_files), game_progress, play_sessions, notes, game_tags, plus the
    catalog-richness tables populated at import/resync time (genres/companies/franchises/
    collections/platforms/screenshots/artworks/videos/release_dates). Add-ons a manual link
    to another game holds are kept, detached (see plan_addon_removal).

    Returns the stored filenames of every deleted ROM and its save states/in-game save, for
    the caller to remove from disk (rom_service.delete_files) once its transaction commits."""
    removal = plan_addon_removal(db, game.id)
    _detach(db, removal.kept_ids)
    return _delete_games(db, [game.id, *removal.deleted_ids])


def delete_addons(db: Session, game: Game) -> list[str]:
    """Deletes the game's addons (not the game itself) and everything that hangs off them,
    like delete_game_with_addons — for Change IGDB link / Unlink from IGDB, where the addons
    came from the old link. Returns their ROM filenames for the caller to remove from disk."""
    removal = plan_addon_removal(db, game.id, game_itself=False)
    _detach(db, removal.kept_ids)
    return _delete_games(db, removal.deleted_ids) if removal.deleted_ids else []


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
    guide_files = [
        name
        for stored, rendered in db.execute(
            select(GameDocument.stored_filename, GameDocument.rendered_filename).where(
                GameDocument.game_id.in_(game_ids)
            )
        )
        for name in (stored, rendered)
        if name
    ]
    GUIDE_STORE.delete_files_after_commit(db, guide_files)
    db.execute(delete(GameDocument).where(GameDocument.game_id.in_(game_ids)))
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
    db.execute(delete(GameAlternativeName).where(GameAlternativeName.game_id.in_(game_ids)))
    db.execute(delete(IgdbImportEntry).where(IgdbImportEntry.game_id.in_(game_ids)))
    # GOG Sync entries stay (the game is still owned on GOG) but lose their match; queued or
    # downloaded installer rows go with the game.
    db.execute(update(GogLibraryEntry).where(GogLibraryEntry.game_id.in_(game_ids)).values(game_id=None))
    db.execute(update(GogWishlistEntry).where(GogWishlistEntry.game_id.in_(game_ids)).values(game_id=None))
    db.execute(delete(GogDownload).where(GogDownload.game_id.in_(game_ids)))
    db.execute(
        delete(GameAddonLink).where(or_(GameAddonLink.addon_game_id.in_(game_ids), GameAddonLink.game_id.in_(game_ids)))
    )
    db.execute(delete(Game).where(Game.id.in_(game_ids)))
    return rom_filenames
