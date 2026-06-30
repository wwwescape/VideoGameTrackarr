from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core import security
from app.core.config import Settings, get_settings


def test_hash_and_verify_password_roundtrip():
    password_hash = security.hash_password("correct-password")

    assert security.verify_password("correct-password", password_hash)
    assert not security.verify_password("wrong-password", password_hash)


def test_hash_password_is_salted():
    assert security.hash_password("same-password") != security.hash_password("same-password")


def test_access_token_roundtrip():
    token = security.create_access_token(user_id=42)
    payload = security.decode_token(token, security.TokenType.ACCESS)

    assert payload["sub"] == "42"
    assert payload["type"] == "access"


def test_refresh_token_roundtrip():
    token, jti, expires_at = security.create_refresh_token(user_id=7)
    payload = security.decode_token(token, security.TokenType.REFRESH)

    assert payload["sub"] == "7"
    assert payload["jti"] == jti
    assert expires_at > datetime.now(UTC)


def test_decode_token_rejects_wrong_type():
    access_token = security.create_access_token(user_id=1)

    with pytest.raises(security.TokenError):
        security.decode_token(access_token, security.TokenType.REFRESH)


def test_decode_token_rejects_tampered_signature():
    token = security.create_access_token(user_id=1) + "tampered"

    with pytest.raises(security.TokenError):
        security.decode_token(token, security.TokenType.ACCESS)


def test_decode_token_rejects_expired_token():
    settings = get_settings()
    now = datetime.now(UTC)
    expired_payload = {
        "sub": "1",
        "type": "access",
        "iat": now - timedelta(hours=1),
        "exp": now - timedelta(minutes=1),
    }
    expired_token = jwt.encode(expired_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    with pytest.raises(security.TokenError):
        security.decode_token(expired_token, security.TokenType.ACCESS)


def test_create_access_token_requires_secret(monkeypatch):
    # `_env_file=None` is required, not just `monkeypatch.delenv` — the repo-root .env
    # (real secrets) is read directly off disk by pydantic-settings and would otherwise
    # still supply JWT_SECRET_KEY even with the env var cleared.
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    monkeypatch.setattr(security, "get_settings", lambda: Settings(_env_file=None))
    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY"):
        security.create_access_token(user_id=1)
