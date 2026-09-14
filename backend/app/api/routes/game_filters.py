from dataclasses import dataclass

from fastapi import Query

from app.models.catalog import GameCategory
from app.models.library import MediaFormat
from app.repositories.game_repository import GameSortOption


@dataclass
class GameFilterParams:
    """The Games list's whole optional filter set (search + 7 dimensions + sort), as a
    FastAPI dependency — shared verbatim by GET /api/games and the Collection/Series
    "addons" endpoints (collections.py/franchises.py) so all three expose identically-named
    query params with zero duplicated Query(...) declarations to drift out of sync. Field
    names match game_service.search_local_games'/collection_service.list_collection_addons'
    kwargs exactly, so a call site can just unpack it as **vars(params)."""

    search: str | None = Query(default=None)
    platform_ids: list[int] | None = Query(default=None, alias="platformId")
    platform_exclude: bool = Query(default=False, alias="platformExclude")
    tag_ids: list[int] | None = Query(default=None, alias="tagId")
    tag_exclude: bool = Query(default=False, alias="tagExclude")
    collection_ids: list[int] | None = Query(default=None, alias="collectionId")
    collection_exclude: bool = Query(default=False, alias="collectionExclude")
    franchise_ids: list[int] | None = Query(default=None, alias="franchiseId")
    franchise_exclude: bool = Query(default=False, alias="franchiseExclude")
    categories: list[GameCategory] | None = Query(default=None, alias="category")
    category_exclude: bool = Query(default=False, alias="categoryExclude")
    formats: list[MediaFormat] | None = Query(default=None, alias="format")
    format_exclude: bool = Query(default=False, alias="formatExclude")
    storefronts: list[str] | None = Query(default=None, alias="storefront")
    storefront_exclude: bool = Query(default=False, alias="storefrontExclude")
    sort: GameSortOption = Query(default=GameSortOption.NAME_ASC)
