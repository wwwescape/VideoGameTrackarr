from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.repositories import region_repository
from app.schemas.region import RegionResponse

router = APIRouter(prefix="/api/regions", tags=["regions"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[RegionResponse])
def list_regions(db: Session = Depends(get_db)) -> list[RegionResponse]:
    regions = region_repository.list_regions(db)
    return [RegionResponse.model_validate(region) for region in regions]
