from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.library import GameProgress


def get_progress(db: Session, game_id: int) -> GameProgress | None:
    return db.scalars(select(GameProgress).where(GameProgress.game_id == game_id)).first()


def upsert_progress(db: Session, game_id: int, **fields: Any) -> GameProgress:
    progress = get_progress(db, game_id)
    if progress is None:
        progress = GameProgress(game_id=game_id)
        db.add(progress)

    for key, value in fields.items():
        setattr(progress, key, value)

    db.flush()
    return progress
