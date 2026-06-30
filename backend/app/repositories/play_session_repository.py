from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.library import PlaySession


def list_play_sessions(db: Session, game_id: int) -> list[PlaySession]:
    stmt = select(PlaySession).where(PlaySession.game_id == game_id).order_by(PlaySession.started_at.desc())
    return list(db.scalars(stmt))


def get_play_session(db: Session, session_id: int) -> PlaySession | None:
    return db.scalars(select(PlaySession).where(PlaySession.id == session_id)).first()


def create_play_session(db: Session, **fields: Any) -> PlaySession:
    session = PlaySession(**fields)
    db.add(session)
    db.flush()
    return session


def update_play_session(db: Session, session: PlaySession, **fields: Any) -> PlaySession:
    for key, value in fields.items():
        setattr(session, key, value)
    db.flush()
    return session


def delete_play_session(db: Session, session: PlaySession) -> None:
    db.delete(session)
    db.flush()
