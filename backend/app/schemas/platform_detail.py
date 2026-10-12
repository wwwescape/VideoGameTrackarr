from app.models.catalog import Platform
from app.repositories.game_repository import GameWithStatus
from app.schemas.base import CamelModel
from app.schemas.game import GameSummaryResponse, game_summary_from_orm


class PlatformDetailResponse(CamelModel):
    id: int
    name: str
    slug: str | None
    abbreviation: str | None
    games: list[GameSummaryResponse]
    addons: list[GameSummaryResponse]


class PlatformSummaryResponse(CamelModel):
    id: int
    igdb_id: int | None
    name: str
    slug: str | None
    abbreviation: str | None
    game_count: int


def platform_detail_from_orm(
    platform: Platform,
    games: list[GameWithStatus],
    addons: list[GameWithStatus],
    on_sale_game_ids: frozenset[int] = frozenset(),
) -> PlatformDetailResponse:
    return PlatformDetailResponse(
        id=platform.id,
        name=platform.name,
        slug=platform.slug,
        abbreviation=platform.abbreviation,
        games=[game_summary_from_orm(game, on_sale_game_ids) for game in games],
        addons=[game_summary_from_orm(addon, on_sale_game_ids) for addon in addons],
    )


def platform_summary_from_orm(platform: Platform, game_count: int) -> PlatformSummaryResponse:
    return PlatformSummaryResponse(
        id=platform.id,
        igdb_id=platform.igdb_id,
        name=platform.name,
        slug=platform.slug,
        abbreviation=platform.abbreviation,
        game_count=game_count,
    )
