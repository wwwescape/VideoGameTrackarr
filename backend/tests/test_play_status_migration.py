"""The play-status migration on a real (scratch) database: the new statuses are accepted
after the upgrade, still rejected before it, and a downgrade folds them into the nearest old
status instead of failing the narrower CHECK constraint."""

from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

from alembic import command
from app.core.config import get_settings

BACKEND_DIR = Path(__file__).resolve().parents[1]
BEFORE = "b9d1f3a5c7e2"


@pytest.fixture()
def alembic_db(tmp_path, monkeypatch):
    url = f"sqlite:///{(tmp_path / 'migrations.db').as_posix()}"
    monkeypatch.setenv("DATABASE_URL", url)
    get_settings.cache_clear()
    # No config file: env.py then leaves the app's logging alone.
    config = Config()
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    yield config, create_engine(url)
    get_settings.cache_clear()


def _insert(engine, row_id, status):
    # SQLite leaves foreign keys off by default, so no game/platform rows are needed.
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO game_progress (id, game_id, platform_id, play_status, playtime_minutes) "
                "VALUES (:id, :id, 1, :status, 0)"
            ),
            {"id": row_id, "status": status},
        )


def _statuses(engine):
    with engine.connect() as connection:
        return dict(connection.execute(text("SELECT id, play_status FROM game_progress ORDER BY id")).all())


def test_new_statuses_round_trip_through_upgrade_and_downgrade(alembic_db):
    config, engine = alembic_db
    command.upgrade(config, BEFORE)
    with pytest.raises(IntegrityError):
        _insert(engine, 99, "on_hold")

    _insert(engine, 1, "completed")
    command.upgrade(config, "head")
    for row_id, status in [(2, "not_started"), (3, "on_hold"), (4, "endless")]:
        _insert(engine, row_id, status)
    with pytest.raises(IntegrityError):
        _insert(engine, 98, "wishlist")
    assert _statuses(engine) == {1: "completed", 2: "not_started", 3: "on_hold", 4: "endless"}

    command.downgrade(config, BEFORE)
    assert _statuses(engine) == {1: "completed", 2: "backlog", 3: "backlog", 4: "playing"}
    with pytest.raises(IntegrityError):
        _insert(engine, 97, "endless")

    command.upgrade(config, "head")
    _insert(engine, 5, "endless")
