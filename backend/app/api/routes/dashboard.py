from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.dashboard import (
    DashboardStatsResponse,
    UpcomingReleaseResponse,
    dashboard_stats_from_data,
    upcoming_release_from_item,
)
from app.services import dashboard_service, insight_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)])


@router.get("/stats", response_model=DashboardStatsResponse)
def get_stats(db: Session = Depends(get_db)) -> DashboardStatsResponse:
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    return dashboard_stats_from_data(dashboard_service.get_stats(db), on_sale_game_ids)


@router.get("/release-calendar", response_model=list[UpcomingReleaseResponse])
def get_release_calendar(db: Session = Depends(get_db)) -> list[UpcomingReleaseResponse]:
    items = dashboard_service.list_upcoming_releases(db)
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    return [upcoming_release_from_item(item, on_sale_game_ids) for item in items]
