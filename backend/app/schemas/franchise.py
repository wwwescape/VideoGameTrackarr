from app.models.catalog import Franchise
from app.repositories.game_repository import GameWithStatus
from app.schemas.base import CamelModel
from app.schemas.game import GameSummaryResponse, game_summary_from_orm


class FranchiseDetailResponse(CamelModel):
    id: int
    name: str
    slug: str | None
    games: list[GameSummaryResponse]


class FranchiseSummaryResponse(CamelModel):
    id: int
    name: str
    slug: str | None
    game_count: int


def franchise_detail_from_orm(franchise: Franchise, games: list[GameWithStatus]) -> FranchiseDetailResponse:
    return FranchiseDetailResponse(
        id=franchise.id,
        name=franchise.name,
        slug=franchise.slug,
        games=[game_summary_from_orm(game) for game in games],
    )


def franchise_summary_from_orm(franchise: Franchise, game_count: int) -> FranchiseSummaryResponse:
    return FranchiseSummaryResponse(id=franchise.id, name=franchise.name, slug=franchise.slug, game_count=game_count)
