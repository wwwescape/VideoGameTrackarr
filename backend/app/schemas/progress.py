from datetime import date

from pydantic import Field

from app.models.library import GameProgress, PlayStatus
from app.schemas.base import CamelModel


class GameProgressResponse(CamelModel):
    game_id: int
    play_status: PlayStatus
    playtime_minutes: int
    rating: float | None
    review: str | None
    started_at: date | None
    completed_at: date | None
    last_played_at: date | None


def game_progress_from_orm(game_id: int, progress: GameProgress | None) -> GameProgressResponse:
    # Every game conceptually has progress, it's just unset until the user touches it —
    # so this returns a default rather than letting callers special-case a 404.
    if progress is None:
        return GameProgressResponse(
            game_id=game_id,
            play_status=PlayStatus.NONE,
            playtime_minutes=0,
            rating=None,
            review=None,
            started_at=None,
            completed_at=None,
            last_played_at=None,
        )
    return GameProgressResponse(
        game_id=progress.game_id,
        play_status=progress.play_status,
        playtime_minutes=progress.playtime_minutes,
        rating=progress.rating,
        review=progress.review,
        started_at=progress.started_at,
        completed_at=progress.completed_at,
        last_played_at=progress.last_played_at,
    )


class GameProgressUpdateRequest(CamelModel):
    play_status: PlayStatus | None = None
    playtime_minutes: int | None = Field(default=None, ge=0)
    rating: float | None = Field(default=None, ge=0, le=10)
    review: str | None = None
    started_at: date | None = None
    completed_at: date | None = None
    last_played_at: date | None = None
