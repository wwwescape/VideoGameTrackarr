from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.franchise import (
    FranchiseDetailResponse,
    FranchiseSummaryResponse,
    franchise_detail_from_orm,
    franchise_summary_from_orm,
)
from app.services import franchise_service

router = APIRouter(prefix="/api/franchises", tags=["franchises"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[FranchiseSummaryResponse])
def list_franchises(db: Session = Depends(get_db)) -> list[FranchiseSummaryResponse]:
    return [franchise_summary_from_orm(franchise, count) for franchise, count in franchise_service.list_franchises(db)]


@router.get("/{slug}", response_model=FranchiseDetailResponse)
def get_franchise(slug: str, db: Session = Depends(get_db)) -> FranchiseDetailResponse:
    franchise, games = franchise_service.get_franchise_with_games(db, slug)
    return franchise_detail_from_orm(franchise, games)
