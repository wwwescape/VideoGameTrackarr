from app.models.catalog import Franchise
from app.repositories.game_repository import GameWithStatus
from app.schemas.base import CamelModel
from app.schemas.game import GameSummaryResponse, game_summary_from_orm


class FranchiseDetailResponse(CamelModel):
    id: int
    name: str
    slug: str | None
    games: list[GameSummaryResponse]
    addons: list[GameSummaryResponse]


class FranchiseSummaryResponse(CamelModel):
    id: int
    name: str
    slug: str | None
    game_count: int
    # Up to 4, for the card's cover grid (see catalog_cover_repository).
    cover_urls: list[str]


def franchise_detail_from_orm(
    franchise: Franchise,
    games: list[GameWithStatus],
    addons: list[GameWithStatus],
    on_sale_game_ids: frozenset[int] = frozenset(),
) -> FranchiseDetailResponse:
    return FranchiseDetailResponse(
        id=franchise.id,
        name=franchise.name,
        slug=franchise.slug,
        games=[game_summary_from_orm(game, on_sale_game_ids) for game in games],
        addons=[game_summary_from_orm(addon, on_sale_game_ids) for addon in addons],
    )


def franchise_summary_from_orm(
    franchise: Franchise, game_count: int, cover_urls: list[str] | None = None
) -> FranchiseSummaryResponse:
    return FranchiseSummaryResponse(
        id=franchise.id, name=franchise.name, slug=franchise.slug, game_count=game_count, cover_urls=cover_urls or []
    )
