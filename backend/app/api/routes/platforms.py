from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.game_filters import GameFilterParams
from app.schemas.game import GameSummaryResponse, game_summary_from_orm
from app.schemas.platform_detail import (
    PlatformDetailResponse,
    PlatformSummaryResponse,
    platform_detail_from_orm,
    platform_summary_from_orm,
)
from app.services import insight_service, platform_service

router = APIRouter(prefix="/api/platforms", tags=["platforms"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[PlatformSummaryResponse])
def list_platforms(db: Session = Depends(get_db)) -> list[PlatformSummaryResponse]:
    platforms = platform_service.list_platforms(db)
    return [platform_summary_from_orm(platform, count) for platform, count in platforms]


@router.get("/{slug}", response_model=PlatformDetailResponse)
def get_platform(slug: str, db: Session = Depends(get_db)) -> PlatformDetailResponse:
    platform, games, addons = platform_service.get_platform_with_games(db, slug)
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    return platform_detail_from_orm(platform, games, addons, on_sale_game_ids)


@router.get("/{slug}/addons", response_model=list[GameSummaryResponse])
def list_platform_addons(
    slug: str, params: GameFilterParams = Depends(), db: Session = Depends(get_db)
) -> list[GameSummaryResponse]:
    addons = platform_service.list_platform_addons(db, slug, **vars(params))
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    return [game_summary_from_orm(addon, on_sale_game_ids) for addon in addons]
