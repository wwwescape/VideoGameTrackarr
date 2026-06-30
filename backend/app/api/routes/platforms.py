from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.repositories import platform_repository
from app.schemas.platform import PlatformResponse

router = APIRouter(prefix="/api/platforms", tags=["platforms"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[PlatformResponse])
def list_platforms(db: Session = Depends(get_db)) -> list[PlatformResponse]:
    platforms = platform_repository.list_platforms(db)
    return [PlatformResponse.model_validate(platform) for platform in platforms]
