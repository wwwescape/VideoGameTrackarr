from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.game_filters import GameFilterParams
from app.schemas.franchise import (
    FranchiseDetailResponse,
    FranchiseSummaryResponse,
    franchise_detail_from_orm,
    franchise_summary_from_orm,
)
from app.schemas.game import GameSummaryResponse, game_summary_from_orm
from app.services import franchise_service, insight_service

router = APIRouter(prefix="/api/franchises", tags=["franchises"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[FranchiseSummaryResponse])
def list_franchises(db: Session = Depends(get_db)) -> list[FranchiseSummaryResponse]:
    return [franchise_summary_from_orm(franchise, count) for franchise, count in franchise_service.list_franchises(db)]


@router.get("/{slug}", response_model=FranchiseDetailResponse)
def get_franchise(slug: str, db: Session = Depends(get_db)) -> FranchiseDetailResponse:
    franchise, games, addons = franchise_service.get_franchise_with_games(db, slug)
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    return franchise_detail_from_orm(franchise, games, addons, on_sale_game_ids)


@router.get("/{slug}/addons", response_model=list[GameSummaryResponse])
def list_franchise_addons(
    slug: str, params: GameFilterParams = Depends(), db: Session = Depends(get_db)
) -> list[GameSummaryResponse]:
    addons = franchise_service.list_franchise_addons(db, slug, **vars(params))
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    return [game_summary_from_orm(addon, on_sale_game_ids) for addon in addons]
