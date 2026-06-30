from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.limiter import limiter
from app.models.system import User
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse, UserResponse
from app.services import auth_service
from app.services.auth_service import AuthError

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        user = auth_service.authenticate_user(db, body.username, body.password)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    access_token, refresh_token = auth_service.issue_tokens(db, user)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
def refresh(request: Request, body: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        access_token, refresh_token = auth_service.rotate_refresh_token(db, body.refresh_token)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest, db: Session = Depends(get_db)) -> None:
    auth_service.revoke_refresh_token(db, body.refresh_token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(id=current_user.id, username=current_user.username)
