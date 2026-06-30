import uuid
from datetime import UTC, datetime, timedelta
from enum import StrEnum

import bcrypt
import jwt

from app.core.config import get_settings


class TokenType(StrEnum):
    ACCESS = "access"
    REFRESH = "refresh"


class TokenError(Exception):
    """Raised for any invalid, expired, malformed, or wrong-type token."""


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def _require_secret() -> str:
    secret = get_settings().jwt_secret_key
    if not secret:
        raise RuntimeError(
            "JWT_SECRET_KEY is not set. Generate one "
            '(e.g. `python -c "import secrets; print(secrets.token_hex(32))"`) '
            "and add it to the repo-root .env."
        )
    return secret


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": TokenType.ACCESS.value,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, _require_secret(), algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: int) -> tuple[str, str, datetime]:
    """Returns (token, jti, expires_at). The caller is responsible for persisting
    (user_id, jti, expires_at) so the token can be revoked before it naturally expires —
    see app/models/system.py: RefreshToken."""
    settings = get_settings()
    now = datetime.now(UTC)
    jti = str(uuid.uuid4())
    expires_at = now + timedelta(days=settings.refresh_token_expire_days)
    payload = {
        "sub": str(user_id),
        "type": TokenType.REFRESH.value,
        "jti": jti,
        "iat": now,
        "exp": expires_at,
    }
    token = jwt.encode(payload, _require_secret(), algorithm=settings.jwt_algorithm)
    return token, jti, expires_at


def decode_token(token: str, expected_type: TokenType) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(token, _require_secret(), algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc

    if payload.get("type") != expected_type.value:
        raise TokenError(f"Expected a {expected_type.value} token")

    return payload
