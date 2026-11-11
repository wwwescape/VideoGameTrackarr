from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.labs import LabResponse, LabUpdateRequest
from app.services import labs

router = APIRouter(tags=["labs"], dependencies=[Depends(get_current_user)])


@router.get("/api/labs", response_model=list[LabResponse])
def list_labs(db: Session = Depends(get_db)) -> list[LabResponse]:
    return [LabResponse(id=lab.id, enabled=enabled) for lab, enabled in labs.list_labs(db)]


@router.put("/api/labs/{lab_id}", response_model=LabResponse)
def update_lab(lab_id: str, body: LabUpdateRequest, db: Session = Depends(get_db)) -> LabResponse:
    labs.set_enabled(db, lab_id, body.enabled)
    return LabResponse(id=lab_id, enabled=labs.is_enabled(db, lab_id))
