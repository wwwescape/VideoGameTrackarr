"""The Game Shelf: one case per (game x platform) you own a physical copy on, like a real
shelf, and a second one when some of those copies are Steelbooks and some aren't. Only
platforms with a shown standard case (game_cases, Settings > Game Cases) are on it: no digital
copies, nothing wishlisted, no cartridge-only systems.

Game-level filters (search, tags, collections, series, type, play status, source) pick the
games exactly as on the Games list. The platform, Steelbook and Contents filters also pick which of
a game's copies become cases, so filtering by PS5 shows a game's PS5 case and not its PS4 one.
Format and storefront filters don't apply: everything here is physical.
"""

from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.models.catalog import Platform
from app.models.game_cases import GameCase
from app.models.library import MediaFormat, PhysicalContents
from app.repositories import game_repository
from app.repositories.game_repository import GameSortOption, ShelfCopy
from app.services import game_case_service

# Labels is sorted in Python on the Games list, so the shelf doesn't offer it: it falls back
# to name.
_UNSUPPORTED_SORTS = {GameSortOption.LABELS_ASC, GameSortOption.LABELS_DESC}
_PLATFORM_SORTS = {GameSortOption.PLATFORMS_ASC, GameSortOption.PLATFORMS_DESC}


@dataclass
class ShelfCase:
    game_id: int
    uuid: str
    slug: str | None
    name: str
    platform_id: int
    # Drawn as a Steelbook, at the platform's Steelbook size.
    steelbook: bool = False


@dataclass
class ShelfPlatform:
    platform: Platform
    case: GameCase


@dataclass
class Shelf:
    cases: list[ShelfCase]
    platforms: list[ShelfPlatform]


def _copy_matches(
    copy: ShelfCopy,
    platform_ids: list[int] | None,
    platform_exclude: bool,
    steelbook_only: bool,
    contents: set[PhysicalContents] | None,
    contents_exclude: bool,
) -> bool:
    if copy.format != MediaFormat.PHYSICAL:
        return False
    if platform_ids and (copy.platform_id in platform_ids) == platform_exclude:
        return False
    # A copy with no contents set matches no value, so "Not code in the box" keeps it.
    if contents is not None and (copy.physical_contents in contents) == contents_exclude:
        return False
    return not steelbook_only or copy.steelbook


def build_shelf(db: Session, **filters: Any) -> Shelf:
    """`filters` are GameFilterParams' fields, as for GET /api/games."""
    if filters.get("sort") in _UNSUPPORTED_SORTS:
        filters["sort"] = GameSortOption.NAME_ASC
    # The Games list's Platforms sort orders whole games by their first copy's platform. Here
    # each case has one platform, so the cases themselves are sorted by it, games A-Z within.
    platform_sort = filters.get("sort") in _PLATFORM_SORTS
    descending = filters.get("sort") == GameSortOption.PLATFORMS_DESC
    if platform_sort:
        filters["sort"] = GameSortOption.NAME_ASC
    platform_ids = filters.get("platform_ids")
    platform_exclude = filters.get("platform_exclude", False)
    steelbook_only = filters.get("steelbook_only", False)
    contents = set(filters["contents"]) if filters.get("contents") else None
    contents_exclude = filters.get("contents_exclude", False)

    game_filters = dict(filters)
    # Everything on the shelf is physical, so format and storefront filters don't apply.
    for values, exclude in (("formats", "format_exclude"), ("storefronts", "storefront_exclude")):
        game_filters[values] = None
        game_filters[exclude] = False
    # "Not PS5" only drops the PS5 cases: on the Games list it drops every game with a PS5
    # copy, which here would also hide its other cases.
    if platform_exclude:
        game_filters["platform_ids"] = None
        game_filters["platform_exclude"] = False
    # Same for "Not code in the box": drop those cases, keep the game's other ones.
    if contents_exclude:
        game_filters["contents"] = None
        game_filters["contents_exclude"] = False

    games = game_repository.list_shelf_games(db, **game_filters)
    copies = game_repository.list_owned_copies(db, [game.id for game in games])
    cases_by_platform = game_case_service.shown_cases_by_platform(db, sorted({copy.platform_id for copy in copies}))

    # Each game's shelved (platform, steelbook) pairs, in the order their copies were added: a
    # standard copy and a Steelbook on the same platform are two cases, as on a real shelf.
    by_game: dict[int, list[tuple[int, bool]]] = {}
    for copy in copies:
        if copy.platform_id not in cases_by_platform:
            continue
        if not _copy_matches(copy, platform_ids, platform_exclude, steelbook_only, contents, contents_exclude):
            continue
        kinds = by_game.setdefault(copy.game_id, [])
        kind = (copy.platform_id, bool(copy.steelbook))
        if kind not in kinds:
            kinds.append(kind)

    cases = [
        ShelfCase(
            game_id=game.id,
            uuid=game.uuid,
            slug=game.slug,
            name=game.name,
            platform_id=platform_id,
            steelbook=steelbook,
        )
        for game in games
        for platform_id, steelbook in by_game.get(game.id, [])
    ]
    present = sorted({case.platform_id for case in cases})
    platforms = [
        ShelfPlatform(platform=platform, case=cases_by_platform[platform.id])
        for platform in (db.get(Platform, platform_id) for platform_id in present)
        if platform is not None
    ]
    if platform_sort:
        names = {entry.platform.id: entry.platform.name.casefold() for entry in platforms}
        # Stable (reverse too), so the games stay A-Z within each platform.
        cases.sort(key=lambda case: names.get(case.platform_id, ""), reverse=descending)
    return Shelf(cases=cases, platforms=platforms)
