from typing import Any

from sqlalchemy import case, select
from sqlalchemy.orm import Session, joinedload

from app.models.library import GameProgress, PlayStatus

# Mirrors game_repository._PLAY_STATUS_PRIORITY — kept as a separate literal rather than a
# shared import since this one orders actual GameProgress rows (for get_derived_progress),
# not a correlated scalar-subquery column.
_PLAY_STATUS_PRIORITY = case(
    (GameProgress.play_status == PlayStatus.PLAYING, 0),
    (GameProgress.play_status == PlayStatus.COMPLETED, 1),
    (GameProgress.play_status == PlayStatus.BACKLOG, 2),
    (GameProgress.play_status == PlayStatus.ABANDONED, 3),
    else_=4,
)


def get_progress(db: Session, game_id: int, platform_id: int) -> GameProgress | None:
    stmt = select(GameProgress).where(GameProgress.game_id == game_id, GameProgress.platform_id == platform_id)
    return db.scalars(stmt).first()


def get_progress_by_id(db: Session, progress_id: int) -> GameProgress | None:
    return db.scalars(select(GameProgress).where(GameProgress.id == progress_id)).first()


def list_progress(db: Session, game_id: int) -> list[GameProgress]:
    stmt = (
        select(GameProgress)
        .options(joinedload(GameProgress.platform))
        .where(GameProgress.game_id == game_id)
        .order_by(GameProgress.id)
    )
    return list(db.scalars(stmt))


def get_derived_progress(db: Session, game_id: int) -> GameProgress | None:
    """The one representative row for game-level views (Game Details' summary embed,
    anywhere a game conceptually has a single play status) — same priority order as
    game_repository's scalar subqueries, just returning the full row instead of one column."""
    stmt = select(GameProgress).where(GameProgress.game_id == game_id).order_by(_PLAY_STATUS_PRIORITY).limit(1)
    return db.scalars(stmt).first()


def create_progress(db: Session, game_id: int, platform_id: int, **fields: Any) -> GameProgress:
    progress = GameProgress(game_id=game_id, platform_id=platform_id, **fields)
    db.add(progress)
    db.flush()
    return progress


def update_progress(db: Session, progress: GameProgress, **fields: Any) -> GameProgress:
    for key, value in fields.items():
        setattr(progress, key, value)
    db.flush()
    return progress


def delete_progress(db: Session, progress: GameProgress) -> None:
    db.delete(progress)
    db.flush()


def upsert_progress(db: Session, game_id: int, platform_id: int, **fields: Any) -> GameProgress:
    """Create-or-blindly-overwrite by (game_id, platform_id) — used by Steam Sync, which is
    an explicit, user-confirmed action allowed to overwrite that platform's progress outright.
    Unlike create_progress, this never raises on an existing row."""
    progress = get_progress(db, game_id, platform_id)
    if progress is None:
        progress = GameProgress(game_id=game_id, platform_id=platform_id)
        db.add(progress)

    for key, value in fields.items():
        setattr(progress, key, value)

    db.flush()
    return progress
