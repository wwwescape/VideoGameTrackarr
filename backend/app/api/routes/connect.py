from collections.abc import Callable

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_session_factory
from app.core.limiter import limiter
from app.schemas.connector import (
    PairRequest,
    PairResponse,
    PollRequest,
    PollResponse,
    SyncRequest,
    SyncResponse,
)
from app.services import connector_service
from app.services.connector_service import ReportedGame

# What other software talks to: no signed-in user here. A device pairs (its code approved by
# someone signed in to the app), then sends its games with the token it got. See the
# connector page in Settings -> Integrations for the same thing with examples.
router = APIRouter(prefix="/api/connect", tags=["connect"])


@router.post("/{slug}/pair", response_model=PairResponse)
@limiter.limit("10/minute")
def pair(request: Request, slug: str, body: PairRequest, db: Session = Depends(get_db)) -> PairResponse:
    pairing, poll_token = connector_service.start_pairing(db, slug, body.device_name)
    approve_url = str(request.base_url).rstrip("/") + f"/connectors/approve?code={pairing.code}"
    return PairResponse(
        code=pairing.code, poll_token=poll_token, approve_url=approve_url, expires_at=pairing.expires_at
    )


@router.post("/{slug}/pair/poll", response_model=PollResponse)
@limiter.limit("30/minute")
def poll(request: Request, slug: str, body: PollRequest, db: Session = Depends(get_db)) -> PollResponse:
    state, token = connector_service.poll_pairing(db, slug, body.poll_token)
    return PollResponse(status=state, token=token)


@router.post("/{slug}/sync", response_model=SyncResponse)
@limiter.limit("30/minute")
def sync(
    request: Request,
    slug: str,
    body: SyncRequest,
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
    session_factory: Callable[[], Session] = Depends(get_session_factory),
) -> SyncResponse:
    token = authorization.removeprefix("Bearer ").strip()
    try:
        connector, _device = connector_service.authenticate_device(db, slug, token)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown device token") from exc
    games = [ReportedGame(external_id=g.id, name=g.name, igdb_id=g.igdb_id, players=g.players) for g in body.games]
    result = connector_service.sync(db, connector, games, body.complete, session_factory)
    return SyncResponse(**result.as_dict())
