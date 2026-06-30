from app.models.catalog import Collection
from app.repositories.game_repository import GameWithStatus
from app.schemas.base import CamelModel
from app.schemas.game import GameSummaryResponse, game_summary_from_orm


class CollectionDetailResponse(CamelModel):
    id: int
    name: str
    slug: str | None
    games: list[GameSummaryResponse]


class CollectionSummaryResponse(CamelModel):
    id: int
    name: str
    slug: str | None
    game_count: int


def collection_detail_from_orm(collection: Collection, games: list[GameWithStatus]) -> CollectionDetailResponse:
    return CollectionDetailResponse(
        id=collection.id,
        name=collection.name,
        slug=collection.slug,
        games=[game_summary_from_orm(game) for game in games],
    )


def collection_summary_from_orm(collection: Collection, game_count: int) -> CollectionSummaryResponse:
    return CollectionSummaryResponse(
        id=collection.id, name=collection.name, slug=collection.slug, game_count=game_count
    )
