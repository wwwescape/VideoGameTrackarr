import threading
import time
from unittest.mock import MagicMock

import httpx
import pytest
import respx

from app.core.config import get_settings
from app.models.catalog import Game
from app.services import catalog_resync_job
from app.services.catalog_resync_job import CatalogResyncKind, CatalogResyncStatus
from app.services.exceptions import ConflictError
from app.services.igdb_client import IGDB_API_BASE, IGDB_TOKEN_URL

TOKEN_RESPONSE = httpx.Response(200, json={"access_token": "test-token", "expires_in": 3600})


def _configure_igdb(monkeypatch):
    # Same reasoning as test_event_sync_jobs.py's own copy — pin credentials so this test's
    # behavior doesn't depend on whatever's in the repo-root .env.
    monkeypatch.setattr(get_settings(), "igdb_client_id", "test-client-id")
    monkeypatch.setattr(get_settings(), "igdb_client_secret", "test-client-secret")


@respx.mock
def test_run_resync_skips_known_games_and_imports_missing_ones(db_session, monkeypatch):
    _configure_igdb(monkeypatch)
    db_session.add(Game(igdb_id=100, name="Already Known", slug="already-known", category=None))
    db_session.commit()

    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/collections").mock(
        return_value=httpx.Response(
            200,
            json=[{"id": 555, "games": [{"id": 100, "game_type": 0}, {"id": 200, "game_type": 0}]}],
        )
    )
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(200, json=[{"id": 200, "name": "Missing Game", "slug": "missing-game", "category": 0}]),
            httpx.Response(200, json=[]),  # get_addons_by_parent_igdb_id(200) -> no addons
        ]
    )

    catalog_resync_job._run_resync(CatalogResyncKind.COLLECTION, 555, lambda: db_session)

    state = catalog_resync_job.get_state()
    assert state.status == CatalogResyncStatus.COMPLETED
    assert state.result.total_candidates == 2
    assert state.result.added == 1
    assert state.result.skipped_existing == 1
    assert state.result.failed == 0

    imported = db_session.query(Game).filter_by(igdb_id=200).one()
    assert imported.name == "Missing Game"
    # The whole point of this column — see Game.auto_discovered's comment — is telling this
    # newly-discovered row apart from one the user actually added.
    assert imported.auto_discovered is True
    already_known = db_session.query(Game).filter_by(igdb_id=100).one()
    assert already_known.auto_discovered is False


@respx.mock
def test_run_resync_isolates_a_bad_game(db_session, monkeypatch):
    _configure_igdb(monkeypatch)

    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/franchises").mock(
        return_value=httpx.Response(
            200,
            json=[{"id": 777, "games": [{"id": 200, "game_type": 0}, {"id": 300, "game_type": 0}]}],
        )
    )
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(200, json=[{"id": 200, "name": "Good Game", "slug": "good-game", "category": 0}]),
            httpx.Response(200, json=[]),  # get_addons_by_parent_igdb_id(200) -> no addons
            httpx.Response(200, json=[]),  # get_games_by_ids([300]) -> not found on IGDB
        ]
    )

    catalog_resync_job._run_resync(CatalogResyncKind.FRANCHISE, 777, lambda: db_session)

    state = catalog_resync_job.get_state()
    assert state.status == CatalogResyncStatus.COMPLETED
    assert state.result.added == 1
    assert state.result.failed == 1
    assert db_session.query(Game).filter_by(igdb_id=200).one().name == "Good Game"


@respx.mock
def test_run_resync_flags_cascade_imported_addons_too(db_session, monkeypatch):
    """import_game_from_igdb cascades in a discovered game's addons via
    get_addons_by_parent_igdb_id — those must be marked auto_discovered too, with no special-
    casing needed (see game_service.import_game_from_igdb passing the same value to both
    upsert calls)."""
    _configure_igdb(monkeypatch)

    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/collections").mock(
        return_value=httpx.Response(200, json=[{"id": 555, "games": [{"id": 200, "game_type": 0}]}])
    )
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(200, json=[{"id": 200, "name": "Missing Game", "slug": "missing-game", "category": 0}]),
            httpx.Response(200, json=[{"id": 201, "name": "Missing Game DLC", "category": 1}]),
        ]
    )

    catalog_resync_job._run_resync(CatalogResyncKind.COLLECTION, 555, lambda: db_session)

    addon = db_session.query(Game).filter_by(igdb_id=201).one()
    assert addon.auto_discovered is True
    assert addon.parent_game_id == db_session.query(Game).filter_by(igdb_id=200).one().id
    assert db_session.query(Game).filter_by(igdb_id=300).first() is None


def test_start_resync_rejects_a_concurrent_resync(monkeypatch):
    release = threading.Event()

    async def blocking_resync(db, kind, ref_igdb_id):
        release.wait(timeout=2)
        return catalog_resync_job.CatalogResyncResult(
            total_candidates=0, added=0, skipped_existing=0, failed=0, failures=[]
        )

    monkeypatch.setattr(catalog_resync_job, "_resync_missing_games", blocking_resync)

    try:
        first_state = catalog_resync_job.start_resync(
            CatalogResyncKind.COLLECTION, 1, "some-slug", "Some Collection", session_factory=MagicMock
        )
        assert first_state.status == CatalogResyncStatus.RUNNING

        with pytest.raises(ConflictError):
            catalog_resync_job.start_resync(
                CatalogResyncKind.COLLECTION, 1, "some-slug", "Some Collection", session_factory=MagicMock
            )
    finally:
        release.set()
        time.sleep(0.05)  # let the background thread finish before the next test's reset


def test_run_resync_records_failure_and_acknowledge_resets_to_idle():
    def failing_session_factory():
        raise RuntimeError("boom")

    catalog_resync_job._run_resync(CatalogResyncKind.COLLECTION, 1, failing_session_factory)

    state = catalog_resync_job.get_state()
    assert state.status == CatalogResyncStatus.FAILED
    assert "boom" in state.error

    catalog_resync_job.acknowledge()
    assert catalog_resync_job.get_state().status == CatalogResyncStatus.IDLE
