"""The Screensaver lab: a full-screen carousel of your games' covers. Every game you own with a
cover is in it unless you opt it out (Game.screensaver_excluded, from its page or in bulk from
the Games list); see game_repository._screensaver_filter for exactly which games qualify."""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.catalog import Game
from app.repositories import game_repository
from app.repositories.game_repository import ScreensaverGame
from app.services.exceptions import NotFoundError

# One fetch's worth of covers. A larger library gets a fresh random sample each time the
# carousel has shown them all, so every cover still comes up over time.
SAMPLE_SIZE = 500


@dataclass
class ScreensaverSample:
    games: list[ScreensaverGame]
    # How many games qualify in all: when it's no more than len(games), the carousel already
    # has every cover and can reshuffle them itself instead of fetching again.
    total: int


def sample(db: Session, limit: int = SAMPLE_SIZE) -> ScreensaverSample:
    return ScreensaverSample(
        games=game_repository.sample_screensaver_games(db, limit),
        total=game_repository.count_screensaver_games(db),
    )


def set_excluded(db: Session, game_id: int, excluded: bool) -> bool:
    if db.get(Game, game_id) is None:
        raise NotFoundError(f"Game {game_id} not found")
    game_repository.set_screensaver_excluded(db, [game_id], excluded)
    db.commit()
    return excluded


def set_excluded_bulk(db: Session, game_ids: list[int], excluded: bool) -> int:
    """For the Games list's selection mode. Unknown ids are skipped, not an error: a game
    deleted in another tab shouldn't fail the rest. Returns how many games were updated."""
    updated = game_repository.set_screensaver_excluded(db, sorted(set(game_ids)), excluded)
    db.commit()
    return updated
