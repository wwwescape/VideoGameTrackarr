from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.system import User
from app.schemas.share import ShareLinkResponse
from app.services import auth_service

router = APIRouter(tags=["share"], dependencies=[Depends(get_current_user)])


@router.get("/api/share-link", response_model=ShareLinkResponse)
def get_share_link(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> ShareLinkResponse:
    token = auth_service.get_or_create_share_token(db, current_user)
    return ShareLinkResponse(token=token)


@router.post("/api/share-link/regenerate", response_model=ShareLinkResponse)
def regenerate_share_link(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> ShareLinkResponse:
    token = auth_service.regenerate_share_token(db, current_user)
    return ShareLinkResponse(token=token)
