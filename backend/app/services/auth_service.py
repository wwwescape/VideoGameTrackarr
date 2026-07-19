from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.security import (
    TokenError,
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.system import RefreshToken, User
from app.services.exceptions import ConflictError


class AuthError(Exception):
    """Raised for any auth failure that should surface as 401 to the API client."""


def authenticate_user(db: Session, username: str, password: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if user is None or not verify_password(password, user.password_hash):
        raise AuthError("Invalid username or password")
    return user


def create_initial_admin(db: Session, username: str, password: str) -> User:
    """Provisions the very first user account from the web setup flow. Re-checks
    emptiness here (not just at the route layer) so this can never become a backdoor
    register endpoint once an admin already exists — see app/api/routes/auth.py's /setup
    docstring for why a public register endpoint is deliberately not otherwise offered."""
    if db.query(User).count() > 0:
        raise ConflictError("Setup has already been completed.")

    user = User(username=username, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def issue_tokens(db: Session, user: User) -> tuple[str, str]:
    access_token = create_access_token(user.id)
    refresh_token, jti, expires_at = create_refresh_token(user.id)
    db.add(RefreshToken(user_id=user.id, jti=jti, expires_at=expires_at))
    db.commit()
    return access_token, refresh_token


def rotate_refresh_token(db: Session, refresh_token: str) -> tuple[str, str]:
    """Validates a refresh token, revokes it, and issues a fresh access+refresh pair.
    Rotation means a stolen refresh token can be replayed at most once before the
    legitimate client's next refresh fails loudly (the record is already revoked)."""
    record, user = _load_active_refresh_token(db, refresh_token)

    record.revoked_at = datetime.now(UTC)
    db.flush()

    return issue_tokens(db, user)


def revoke_refresh_token(db: Session, refresh_token: str) -> None:
    try:
        record, _ = _load_active_refresh_token(db, refresh_token)
    except AuthError:
        return  # logout is idempotent: an already-invalid token is not an error

    record.revoked_at = datetime.now(UTC)
    db.commit()


def _load_active_refresh_token(db: Session, refresh_token: str) -> tuple[RefreshToken, User]:
    try:
        payload = decode_token(refresh_token, TokenType.REFRESH)
    except TokenError as exc:
        raise AuthError(str(exc)) from exc

    record = db.query(RefreshToken).filter(RefreshToken.jti == payload.get("jti")).first()
    if record is None or record.revoked_at is not None:
        raise AuthError("Refresh token has been revoked")

    user = db.get(User, record.user_id)
    if user is None:
        raise AuthError("User no longer exists")

    return record, user
