from datetime import datetime

from pydantic import Field

from app.models.library import PlaySession
from app.schemas.base import CamelModel


class PlaySessionResponse(CamelModel):
    id: int
    game_id: int
    platform_id: int
    platform_name: str | None
    started_at: datetime
    ended_at: datetime | None
    duration_minutes: int | None
    notes: str | None


def play_session_from_orm(session: PlaySession) -> PlaySessionResponse:
    return PlaySessionResponse(
        id=session.id,
        game_id=session.game_id,
        platform_id=session.platform_id,
        platform_name=session.platform.name if session.platform else None,
        started_at=session.started_at,
        ended_at=session.ended_at,
        duration_minutes=session.duration_minutes,
        notes=session.notes,
    )


class PlaySessionCreateRequest(CamelModel):
    platform_id: int
    started_at: datetime
    ended_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    notes: str | None = None


class PlaySessionUpdateRequest(CamelModel):
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=0)
    notes: str | None = None
