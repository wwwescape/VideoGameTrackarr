from typing import Any

from sqlalchemy.orm import Session

from app.models.library import GameProgress, PlaySession
from app.repositories import game_progress_repository, game_repository, play_session_repository
from app.services.exceptions import NotFoundError


def get_progress(db: Session, game_id: int) -> GameProgress | None:
    _require_game(db, game_id)
    return game_progress_repository.get_progress(db, game_id)


def update_progress(db: Session, game_id: int, **fields: Any) -> GameProgress:
    _require_game(db, game_id)
    progress = game_progress_repository.upsert_progress(db, game_id, **fields)
    db.commit()
    db.refresh(progress)
    return progress


def list_play_sessions(db: Session, game_id: int) -> list[PlaySession]:
    _require_game(db, game_id)
    return play_session_repository.list_play_sessions(db, game_id)


def create_play_session(db: Session, game_id: int, **fields: Any) -> PlaySession:
    _require_game(db, game_id)
    session = play_session_repository.create_play_session(db, game_id=game_id, **_with_computed_duration(fields))
    db.commit()
    db.refresh(session)
    return session


def update_play_session(db: Session, session_id: int, **fields: Any) -> PlaySession:
    session = _require_play_session(db, session_id)
    session = play_session_repository.update_play_session(db, session, **_with_computed_duration(fields, session))
    db.commit()
    db.refresh(session)
    return session


def delete_play_session(db: Session, session_id: int) -> None:
    session = _require_play_session(db, session_id)
    play_session_repository.delete_play_session(db, session)
    db.commit()


def _with_computed_duration(fields: dict[str, Any], existing: PlaySession | None = None) -> dict[str, Any]:
    """If both ends of a session are known but duration wasn't given explicitly, derive
    it — saves the common case (logged a start and end time) from also having to do
    the arithmetic by hand."""
    if fields.get("duration_minutes") is not None:
        return fields

    started_at = fields.get("started_at", existing.started_at if existing else None)
    ended_at = fields.get("ended_at", existing.ended_at if existing else None)
    if started_at and ended_at:
        fields = {**fields, "duration_minutes": max(0, round((ended_at - started_at).total_seconds() / 60))}
    return fields


def _require_game(db: Session, game_id: int) -> None:
    if game_repository.get_game(db, game_id) is None:
        raise NotFoundError(f"Game {game_id} not found")


def _require_play_session(db: Session, session_id: int) -> PlaySession:
    session = play_session_repository.get_play_session(db, session_id)
    if session is None:
        raise NotFoundError(f"Play session {session_id} not found")
    return session
