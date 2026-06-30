from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.insights import (
    DuplicateLibraryItemGroupResponse,
    InsightAccessoryRefResponse,
    MissingDlcResponse,
    duplicate_group_from_orm,
    insight_accessory_ref_from_orm,
    missing_dlc_from_orm,
)
from app.services import insight_service

router = APIRouter(prefix="/api/insights", tags=["insights"], dependencies=[Depends(get_current_user)])


@router.get("/duplicate-library-items", response_model=list[DuplicateLibraryItemGroupResponse])
def list_duplicate_library_items(db: Session = Depends(get_db)) -> list[DuplicateLibraryItemGroupResponse]:
    groups = insight_service.find_duplicate_library_items(db)
    return [duplicate_group_from_orm(group) for group in groups]


@router.get("/missing-dlc", response_model=list[MissingDlcResponse])
def list_missing_dlc(db: Session = Depends(get_db)) -> list[MissingDlcResponse]:
    results = insight_service.find_missing_dlc(db)
    return [missing_dlc_from_orm(game, missing) for game, missing in results]


@router.get("/accessories-without-owned-hardware", response_model=list[InsightAccessoryRefResponse])
def list_accessories_without_owned_hardware(db: Session = Depends(get_db)) -> list[InsightAccessoryRefResponse]:
    accessories = insight_service.find_accessories_without_owned_hardware(db)
    return [insight_accessory_ref_from_orm(accessory) for accessory in accessories]
