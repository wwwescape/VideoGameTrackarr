from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.system import User
from app.schemas.share import ShareLinkResponse
from app.services import auth_service

router = APIRouter(tags=["share"], dependencies=[Depends(get_current_user)])


@router.get("/api/share-link", response_model=ShareLinkResponse)
def get_share_link(current_user: User = Depends(get_current_user)) -> ShareLinkResponse:
    """The current share token, or null while sharing is off. Never creates one."""
    return ShareLinkResponse(token=auth_service.get_share_token(current_user))


@router.post("/api/share-link", response_model=ShareLinkResponse)
def enable_share_link(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> ShareLinkResponse:
    """Turns sharing on (a no-op if it already is), returning the token."""
    return ShareLinkResponse(token=auth_service.get_or_create_share_token(db, current_user))


@router.delete("/api/share-link", status_code=status.HTTP_204_NO_CONTENT)
def disable_share_link(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    auth_service.disable_share_token(db, current_user)


@router.post("/api/share-link/regenerate", response_model=ShareLinkResponse)
def regenerate_share_link(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> ShareLinkResponse:
    token = auth_service.regenerate_share_token(db, current_user)
    return ShareLinkResponse(token=token)
