from dataclasses import dataclass
from typing import Annotated

from fastapi import Query
from pydantic import StringConstraints

from app.models.catalog import GameCategory
from app.models.library import MediaFormat, PlayStatus
from app.repositories.game_repository import GameSortOption, GameSource, ReleaseStatus

# "<platform id>" or "<platform id>:<format>:<storefront>" — checked per value, so a malformed
# one is a 422 rather than reaching _platform_scope_clause.
PlatformScope = Annotated[str, StringConstraints(pattern=r"^\d+(:[a-z]*(:.*)?)?$")]


@dataclass
class GameFilterParams:
    """The Games list's whole optional filter set (search + 8 dimensions + sort), as a
    FastAPI dependency — shared verbatim by GET /api/games and the Collection/Series
    "addons" endpoints (collections.py/franchises.py) so all three expose identically-named
    query params with zero duplicated Query(...) declarations to drift out of sync. Field
    names match game_service.search_local_games'/collection_service.list_collection_addons'
    kwargs exactly, so a call site can just unpack it as **vars(params)."""

    search: str | None = Query(default=None)
    platform_ids: list[int] | None = Query(default=None, alias="platformId")
    platform_exclude: bool = Query(default=False, alias="platformExclude")
    platform_match_all: bool = Query(default=False, alias="platformMatchAll")
    tag_ids: list[int] | None = Query(default=None, alias="tagId")
    tag_exclude: bool = Query(default=False, alias="tagExclude")
    tag_match_all: bool = Query(default=False, alias="tagMatchAll")
    collection_ids: list[int] | None = Query(default=None, alias="collectionId")
    collection_exclude: bool = Query(default=False, alias="collectionExclude")
    collection_match_all: bool = Query(default=False, alias="collectionMatchAll")
    franchise_ids: list[int] | None = Query(default=None, alias="franchiseId")
    franchise_exclude: bool = Query(default=False, alias="franchiseExclude")
    franchise_match_all: bool = Query(default=False, alias="franchiseMatchAll")
    categories: list[GameCategory] | None = Query(default=None, alias="category")
    category_exclude: bool = Query(default=False, alias="categoryExclude")
    formats: list[MediaFormat] | None = Query(default=None, alias="format")
    format_exclude: bool = Query(default=False, alias="formatExclude")
    format_match_all: bool = Query(default=False, alias="formatMatchAll")
    storefronts: list[str] | None = Query(default=None, alias="storefront")
    storefront_exclude: bool = Query(default=False, alias="storefrontExclude")
    storefront_match_all: bool = Query(default=False, alias="storefrontMatchAll")
    play_statuses: list[PlayStatus] | None = Query(default=None, alias="playStatus")
    play_status_exclude: bool = Query(default=False, alias="playStatusExclude")
    play_status_match_all: bool = Query(default=False, alias="playStatusMatchAll")
    # A plain boolean, unlike every filter above — a copy either is or isn't a Steelbook, so
    # there's no multi-value list and no "Exclude" toggle worth offering for a single flag.
    steelbook_only: bool = Query(default=False, alias="steelbookOnly")
    sources: list[GameSource] | None = Query(default=None, alias="source")
    source_exclude: bool = Query(default=False, alias="sourceExclude")
    # A Platforms-page card ("<id>" or "<id>:<format>:<storefront>", e.g. PC · Steam), sharing
    # platformExclude/platformMatchAll with platformId — see _platform_scope_clause.
    platform_scopes: list[PlatformScope] | None = Query(default=None, alias="platformScope")
    genre_ids: list[int] | None = Query(default=None, alias="genreId")
    genre_exclude: bool = Query(default=False, alias="genreExclude")
    genre_match_all: bool = Query(default=False, alias="genreMatchAll")
    release_statuses: list[ReleaseStatus] | None = Query(default=None, alias="releaseStatus")
    release_year_from: int | None = Query(default=None, alias="releaseYearFrom", ge=1950, le=2100)
    release_year_to: int | None = Query(default=None, alias="releaseYearTo", ge=1950, le=2100)
    # Single thresholds rather than lists: "at least N players"/"under N hours" is how these
    # get asked, and a game only has one value for each.
    local_players_min: int | None = Query(default=None, alias="localPlayersMin", ge=1, le=16)
    online_multiplayer_only: bool = Query(default=False, alias="onlineMultiplayerOnly")
    coop_only: bool = Query(default=False, alias="coopOnly")
    time_to_beat_min: int | None = Query(default=None, alias="timeToBeatMin", ge=0, le=1000)
    time_to_beat_max: int | None = Query(default=None, alias="timeToBeatMax", ge=1, le=1000)
    rating_min: int | None = Query(default=None, alias="ratingMin", ge=0, le=100)
    sort: GameSortOption = Query(default=GameSortOption.NAME_ASC)
