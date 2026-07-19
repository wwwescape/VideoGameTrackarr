from collections.abc import Callable, Generator

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import TokenError, TokenType, decode_token
from app.db.session import SessionLocal
from app.models.system import User
from app.services.igdb_client import IGDBClient

bearer_scheme = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_session_factory() -> Callable[[], Session]:
    """A callable that opens a *new* Session, for code that outlives a single request (e.g.
    the restore background job in app/services/restore_job.py) — the request-scoped
    Session from get_db() is closed as soon as the route returns, before any background
    thread it kicked off gets to use it. Overridden in tests the same way get_db is, so a
    background thread's session lands on the test's tmp_path engine rather than the app's
    real configured one."""
    return SessionLocal


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise unauthorized

    try:
        payload = decode_token(credentials.credentials, TokenType.ACCESS)
    except TokenError as exc:
        raise unauthorized from exc

    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise unauthorized

    return user


def get_igdb_client(request: Request) -> IGDBClient:
    """One IGDBClient (and its underlying httpx connection pool) for the whole app
    lifetime — see app/main.py's lifespan — rather than a new httpx.AsyncClient (and a
    fresh TCP/TLS handshake) on every request."""
    return request.app.state.igdb_client
