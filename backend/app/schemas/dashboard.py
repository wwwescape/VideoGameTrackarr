from typing import Literal

from app.repositories.dashboard_repository import DashboardStatsData
from app.schemas.accessory import AccessorySummaryResponse, accessory_summary_from_orm
from app.schemas.base import CamelModel
from app.schemas.device import DeviceSummaryResponse, device_summary_from_orm
from app.schemas.game import GameSummaryResponse, game_summary_from_orm
from app.services.dashboard_service import UpcomingReleaseItem


class NamedCountResponse(CamelModel):
    name: str
    count: int


class DashboardStatsResponse(CamelModel):
    total_owned: int
    total_wishlisted: int
    total_tracked: int
    total_playtime_minutes: int
    average_rating: float | None
    play_status_breakdown: dict[str, int]
    platform_breakdown: list[NamedCountResponse]
    genre_breakdown: list[NamedCountResponse]
    recently_added: list[GameSummaryResponse]
    recently_played: list[GameSummaryResponse]


def dashboard_stats_from_data(data: DashboardStatsData) -> DashboardStatsResponse:
    return DashboardStatsResponse(
        total_owned=data.total_owned,
        total_wishlisted=data.total_wishlisted,
        total_tracked=data.total_tracked,
        total_playtime_minutes=data.total_playtime_minutes,
        average_rating=data.average_rating,
        play_status_breakdown=data.play_status_breakdown,
        platform_breakdown=[NamedCountResponse(name=p.name, count=p.count) for p in data.platform_breakdown],
        genre_breakdown=[NamedCountResponse(name=g.name, count=g.count) for g in data.genre_breakdown],
        recently_added=[game_summary_from_orm(g) for g in data.recently_added],
        recently_played=[game_summary_from_orm(g) for g in data.recently_played],
    )


class UpcomingReleaseResponse(CamelModel):
    kind: Literal["game", "device", "accessory"]
    game: GameSummaryResponse | None = None
    device: DeviceSummaryResponse | None = None
    accessory: AccessorySummaryResponse | None = None
    release_date: str


def upcoming_release_from_item(item: UpcomingReleaseItem) -> UpcomingReleaseResponse:
    return UpcomingReleaseResponse(
        kind=item.kind,
        game=game_summary_from_orm(item.game) if item.game else None,
        device=device_summary_from_orm(item.device) if item.device else None,
        accessory=accessory_summary_from_orm(item.accessory) if item.accessory else None,
        release_date=item.release_date.isoformat(),
    )
