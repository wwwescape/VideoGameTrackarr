import threading
import time
from unittest.mock import MagicMock

import pytest

from app.models.catalog import Game, GameCategory
from app.models.library import LibraryStatus, MediaFormat
from app.repositories.game_repository import GameWithStatus
from app.services import bulk_import_job, game_service, library_service, tag_service
from app.services.exceptions import ConflictError


def _fake_game_with_status(game: Game) -> GameWithStatus:
    return GameWithStatus(game=game, owned=False, wishlisted=False, play_status=None, rating=None)


def test_start_bulk_import_rejects_a_concurrent_import(monkeypatch):
    release = threading.Event()

    async def blocking_import(db, igdb_client, igdb_id):
        release.wait(timeout=2)
        raise RuntimeError("never reached")

    monkeypatch.setattr(game_service, "import_game_from_igdb", blocking_import)

    try:
        first_state = bulk_import_job.start_bulk_import([1], [], None, session_factory=MagicMock)
        assert first_state.status == bulk_import_job.BulkImportJobStatus.RUNNING

        with pytest.raises(ConflictError):
            bulk_import_job.start_bulk_import([2], [], None, session_factory=MagicMock)
    finally:
        release.set()
        time.sleep(0.05)  # let the background thread finish before the next test's reset


def test_run_isolates_a_per_game_failure_and_continues(db_session, monkeypatch):
    games = [Game(igdb_id=100 + i, name=f"Game {i}", category=GameCategory.MAIN_GAME) for i in range(3)]

    async def fake_import(db, igdb_client, igdb_id):
        if igdb_id == 101:
            raise RuntimeError("removed from IGDB")
        game = games[igdb_id - 100]
        db.add(game)
        db.commit()
        return _fake_game_with_status(game)

    monkeypatch.setattr(game_service, "import_game_from_igdb", fake_import)

    bulk_import_job._run([100, 101, 102], [], None, lambda: db_session)

    state = bulk_import_job.get_state()
    assert state.status == bulk_import_job.BulkImportJobStatus.COMPLETED
    assert state.result["total"] == 3
    assert state.result["succeeded"] == 2
    assert state.result["failed"] == 1
    assert state.result["failures"] == [{"igdbId": 101, "gameName": None, "error": "removed from IGDB"}]


def test_run_reports_progress_after_each_game(db_session, monkeypatch):
    async def fake_import(db, igdb_client, igdb_id):
        game = Game(igdb_id=igdb_id, name=f"Game {igdb_id}", category=GameCategory.MAIN_GAME)
        db.add(game)
        db.commit()
        return _fake_game_with_status(game)

    monkeypatch.setattr(game_service, "import_game_from_igdb", fake_import)

    reported: list[tuple[int, int]] = []
    monkeypatch.setattr(
        bulk_import_job, "_set_progress", lambda current, total: reported.append((current, total))
    )

    bulk_import_job._run([200, 201, 202], [], None, lambda: db_session)

    assert reported == [(1, 3), (2, 3), (3, 3)]


def test_run_attaches_chosen_tags_to_every_imported_game(db_session, monkeypatch):
    tag = tag_service.create_tag(db_session, "Co-op", None, None)

    async def fake_import(db, igdb_client, igdb_id):
        game = Game(igdb_id=igdb_id, name=f"Game {igdb_id}", category=GameCategory.MAIN_GAME)
        db.add(game)
        db.commit()
        return _fake_game_with_status(game)

    monkeypatch.setattr(game_service, "import_game_from_igdb", fake_import)

    bulk_import_job._run([300], [tag.id], None, lambda: db_session)

    state = bulk_import_job.get_state()
    assert state.result["succeeded"] == 1
    imported_game = db_session.query(Game).filter_by(igdb_id=300).one()
    assert [t.id for t in tag_service.list_tags_for_game(db_session, imported_game.id)] == [tag.id]


def test_run_creates_a_library_item_when_library_defaults_given(db_session, monkeypatch):
    async def fake_import(db, igdb_client, igdb_id):
        game = Game(igdb_id=igdb_id, name="Game 400", category=GameCategory.MAIN_GAME)
        db.add(game)
        db.commit()
        return _fake_game_with_status(game)

    monkeypatch.setattr(game_service, "import_game_from_igdb", fake_import)

    library_defaults = {
        "status": LibraryStatus.OWNED,
        "platform_id": None,
        "format": MediaFormat.PHYSICAL,
        "digital_storefront": None,
    }
    bulk_import_job._run([400], [], library_defaults, lambda: db_session)

    imported_game = db_session.query(Game).filter_by(igdb_id=400).one()
    items = library_service.list_library_items(db_session, imported_game.id)
    assert len(items) == 1
    assert items[0].status == LibraryStatus.OWNED
    assert items[0].format == MediaFormat.PHYSICAL


def test_run_skips_library_item_when_defaults_are_none(db_session, monkeypatch):
    async def fake_import(db, igdb_client, igdb_id):
        game = Game(igdb_id=igdb_id, name="Game 500", category=GameCategory.MAIN_GAME)
        db.add(game)
        db.commit()
        return _fake_game_with_status(game)

    monkeypatch.setattr(game_service, "import_game_from_igdb", fake_import)

    bulk_import_job._run([500], [], None, lambda: db_session)

    imported_game = db_session.query(Game).filter_by(igdb_id=500).one()
    assert library_service.list_library_items(db_session, imported_game.id) == []


def test_run_records_failure_when_tag_attachment_fails_but_keeps_the_imported_game(db_session, monkeypatch):
    async def fake_import(db, igdb_client, igdb_id):
        game = Game(igdb_id=igdb_id, name="Game 600", category=GameCategory.MAIN_GAME)
        db.add(game)
        db.commit()
        return _fake_game_with_status(game)

    monkeypatch.setattr(game_service, "import_game_from_igdb", fake_import)
    # A nonexistent tag id — attach_tag will 404 via _require_tag in the real route, but the
    # repository-level call used directly here just needs to raise for this test's purposes.
    monkeypatch.setattr(
        tag_service, "attach_tag", lambda db, game_id, tag_id: (_ for _ in ()).throw(RuntimeError("tag gone"))
    )

    bulk_import_job._run([600], [999], None, lambda: db_session)

    state = bulk_import_job.get_state()
    assert state.result["succeeded"] == 0
    assert state.result["failed"] == 1
    assert "Game was imported, but failed to apply tags/library entry" in state.result["failures"][0]["error"]
    # The game itself is still there despite being reported as a failure.
    assert db_session.query(Game).filter_by(igdb_id=600).one_or_none() is not None


def test_acknowledge_resets_a_completed_run_to_idle(db_session, monkeypatch):
    async def fake_import(db, igdb_client, igdb_id):
        game = Game(igdb_id=igdb_id, name="Game 700", category=GameCategory.MAIN_GAME)
        db.add(game)
        db.commit()
        return _fake_game_with_status(game)

    monkeypatch.setattr(game_service, "import_game_from_igdb", fake_import)

    bulk_import_job._run([700], [], None, lambda: db_session)
    assert bulk_import_job.get_state().status == bulk_import_job.BulkImportJobStatus.COMPLETED

    bulk_import_job.acknowledge()
    assert bulk_import_job.get_state().status == bulk_import_job.BulkImportJobStatus.IDLE


def test_acknowledge_is_a_no_op_while_running(monkeypatch):
    release = threading.Event()

    async def blocking_import(db, igdb_client, igdb_id):
        release.wait(timeout=2)
        raise RuntimeError("never reached")

    monkeypatch.setattr(game_service, "import_game_from_igdb", blocking_import)

    try:
        bulk_import_job.start_bulk_import([1], [], None, session_factory=MagicMock)
        bulk_import_job.acknowledge()
        assert bulk_import_job.get_state().status == bulk_import_job.BulkImportJobStatus.RUNNING
    finally:
        release.set()
        time.sleep(0.05)  # let the background thread finish before the next test's reset
