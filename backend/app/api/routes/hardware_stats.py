from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.hardware_stats import HardwareStatsResponse, hardware_stats_from_data
from app.services import hardware_stats_service

router = APIRouter(tags=["hardware-stats"], dependencies=[Depends(get_current_user)])


@router.get("/api/hardware-stats", response_model=HardwareStatsResponse)
def get_hardware_stats(db: Session = Depends(get_db)) -> HardwareStatsResponse:
    return hardware_stats_from_data(hardware_stats_service.get_stats(db))
