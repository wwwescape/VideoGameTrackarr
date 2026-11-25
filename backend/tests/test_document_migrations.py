"""The Manuals & Documents migrations on a real (scratch) database: game_guides becomes
game_documents with its rows and ids kept, the manual URLs are baked in, and a downgrade puts
game_guides back without the rows it can't hold."""

from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, text

from alembic import command
from app.core.config import get_settings

BACKEND_DIR = Path(__file__).resolve().parents[1]
BEFORE = "a7c9e1f3b5d8"


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


def _rows(engine, sql):
    with engine.connect() as connection:
        return connection.execute(text(sql)).all()


def test_rename_keeps_rows_and_downgrade_drops_what_it_cannot_hold(alembic_db):
    config, engine = alembic_db
    command.upgrade(config, BEFORE)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO game_guides (id, game_id, name, kind, source, url)"
                " VALUES (7, 1, 'Walkthrough', 'guide', 'link', 'https://example.com/w')"
            )
        )

    command.upgrade(config, "head")
    assert _rows(engine, "SELECT id, name, kind FROM game_documents") == [(7, "Walkthrough", "guide")]
    assert not _rows(engine, "SELECT name FROM sqlite_master WHERE name = 'game_guides'")
    assert _rows(
        engine, "SELECT manual_url FROM hardware_reference_entries WHERE official_name = 'Sony PlayStation 4'"
    ) == [("https://manuals.playstation.net/document/en/ps4/",)]
    lego = dict(_rows(engine, "SELECT set_number, manual_url FROM toys_to_life_items WHERE line = 'lego-dimensions'"))
    assert lego["71170"] == "https://www.lego.com/en-us/service/building-instructions/71170"
    assert lego["71340"] is None
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO game_documents (id, game_id, name, kind, source, url)"
                " VALUES (8, 1, 'Booklet', 'manual', 'link', 'https://example.com/m')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO hardware_documents (device_id, name, kind, source, url)"
                " VALUES (1, 'Manual', 'manual', 'link', 'https://example.com/d')"
            )
        )

    command.downgrade(config, BEFORE)
    assert _rows(engine, "SELECT id, kind FROM game_guides") == [(7, "guide")]
    tables = {name for (name,) in _rows(engine, "SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert not {"game_documents", "hardware_documents", "toys_to_life_documents"} & tables

    command.upgrade(config, "head")
    assert _rows(engine, "SELECT id FROM game_documents") == [(7,)]
