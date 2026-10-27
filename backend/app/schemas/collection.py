from app.models.catalog import Collection
from app.repositories.game_repository import GameWithStatus
from app.schemas.base import CamelModel
from app.schemas.game import GameSummaryResponse, game_summary_from_orm


class CollectionDetailResponse(CamelModel):
    id: int
    name: str
    slug: str | None
    games: list[GameSummaryResponse]
    addons: list[GameSummaryResponse]


class CollectionSummaryResponse(CamelModel):
    id: int
    name: str
    slug: str | None
    game_count: int
    # How many of those games you own.
    owned_count: int
    # Up to 4, for the card's cover grid (see catalog_cover_repository).
    cover_urls: list[str]


def collection_detail_from_orm(
    collection: Collection,
    games: list[GameWithStatus],
    addons: list[GameWithStatus],
    on_sale_game_ids: frozenset[int] = frozenset(),
) -> CollectionDetailResponse:
    return CollectionDetailResponse(
        id=collection.id,
        name=collection.name,
        slug=collection.slug,
        games=[game_summary_from_orm(game, on_sale_game_ids) for game in games],
        addons=[game_summary_from_orm(addon, on_sale_game_ids) for addon in addons],
    )


def collection_summary_from_orm(
    collection: Collection, game_count: int, cover_urls: list[str] | None = None, owned_count: int = 0
) -> CollectionSummaryResponse:
    return CollectionSummaryResponse(
        id=collection.id,
        name=collection.name,
        slug=collection.slug,
        game_count=game_count,
        owned_count=owned_count,
        cover_urls=cover_urls or [],
    )
