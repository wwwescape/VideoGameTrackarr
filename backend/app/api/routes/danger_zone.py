from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.base import CamelModel
from app.services import danger_zone_service
from app.services.danger_zone_service import DangerZoneAction

router = APIRouter(prefix="/api/danger-zone", tags=["danger-zone"], dependencies=[Depends(get_current_user)])


class DangerZoneRequest(CamelModel):
    # The three resets need "RESET" typed here; the clear actions ignore it.
    confirmation: str | None = None


class DangerZoneResponse(CamelModel):
    removed: dict[str, int]
    # Where the pre-reset safety snapshot was saved on the server (resets only).
    safety_snapshot_path: str | None


@router.post("/{action}", response_model=DangerZoneResponse)
def run_action(action: DangerZoneAction, body: DangerZoneRequest, db: Session = Depends(get_db)) -> DangerZoneResponse:
    result = danger_zone_service.run(db, action, body.confirmation)
    return DangerZoneResponse(removed=result.removed, safety_snapshot_path=result.safety_snapshot_path)
