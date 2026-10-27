from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.limiter import limiter
from app.models.system import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    PreferencesRequest,
    RefreshRequest,
    SetupRequest,
    SetupStatusResponse,
    TokenResponse,
    UserResponse,
)
from app.services import auth_service
from app.services.auth_service import AuthError, SetupCodeError, WrongPasswordError

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


@router.get("/setup-status", response_model=SetupStatusResponse)
def setup_status(db: Session = Depends(get_db)) -> SetupStatusResponse:
    return SetupStatusResponse(setup_required=db.query(User).count() == 0)


@router.post("/setup", response_model=TokenResponse)
@limiter.limit("5/minute")
def setup(request: Request, body: SetupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Creates the very first admin account from the web UI, so a fresh instance no longer
    requires `docker compose exec app python -m scripts.create_admin`. Deliberately not a
    general-purpose register endpoint — create_initial_admin rejects this once any user
    already exists (see app/services/auth_service.py), and that rejection surfaces as a 409
    via the app-wide ConflictError handler in app/main.py."""
    try:
        user = auth_service.create_initial_admin(db, body.username, body.password, body.setup_code)
    except SetupCodeError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
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
    return _user_response(current_user)


@router.put("/me/preferences", response_model=UserResponse)
def update_preferences(
    body: PreferencesRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> UserResponse:
    """Display preferences kept on the server, so every browser shows the same (the currency
    and the Overview's section order; colour mode and language stay per browser). Only the
    fields sent are changed."""
    layout = [section.model_dump() for section in body.overview_layout] if body.overview_layout is not None else None
    user = auth_service.set_preferences(db, current_user, currency=body.currency, overview_layout=layout)
    return _user_response(user)


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id, username=user.username, currency=user.currency, overview_layout=user.overview_layout
    )


@router.post("/change-password", response_model=TokenResponse)
@limiter.limit("5/minute")
def change_password(
    request: Request,
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Changes the signed-in user's password. Every existing session is signed out (their
    refresh tokens revoked); this one gets fresh tokens so it stays signed in. Rate limited
    like login, so a stolen session can't guess the current password either."""
    try:
        auth_service.change_password(db, current_user, body.current_password, body.new_password)
    except WrongPasswordError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    access_token, refresh_token = auth_service.issue_tokens(db, current_user)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)
