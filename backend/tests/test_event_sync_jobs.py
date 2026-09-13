import pytest

from app.core.config import get_settings
from app.models.events import Event
from app.services import event_sync_jobs
from app.services.igdb_client import IGDBClient, IGDBCredentialsError


def _configure_igdb(monkeypatch):
    # The repo-root .env may have real IGDB_CLIENT_ID/SECRET for local dev use — pin both
    # explicitly so this test's behavior doesn't depend on whatever's in .env, same reasoning
    # as test_itad_jobs.py's equivalent.
    monkeypatch.setattr(get_settings(), "igdb_client_id", "test-client-id")
    monkeypatch.setattr(get_settings(), "igdb_client_secret", "test-client-secret")


def test_run_requires_igdb_configuration(db_session, monkeypatch):
    monkeypatch.setattr(get_settings(), "igdb_client_id", None)
    monkeypatch.setattr(get_settings(), "igdb_client_secret", None)

    with pytest.raises(IGDBCredentialsError):
        event_sync_jobs.run(lambda: db_session)


def test_run_upserts_upcoming_events(db_session, monkeypatch):
    _configure_igdb(monkeypatch)

    async def fake_get_upcoming_events(self):
        return [
            {
                "id": 1,
                "name": "Gamescom 2026",
                "slug": "gamescom-2026",
                "start_time": 100,
                "end_time": 9999999999,
            }
        ]

    monkeypatch.setattr(IGDBClient, "get_upcoming_events", fake_get_upcoming_events)

    result = event_sync_jobs.run(lambda: db_session)

    assert result == {"total": 1, "succeeded": 1, "failed": 0, "failures": [], "pruned": 0}
    [event] = db_session.query(Event).all()
    assert event.name == "Gamescom 2026"


def test_run_isolates_a_bad_payload(db_session, monkeypatch):
    _configure_igdb(monkeypatch)

    async def fake_get_upcoming_events(self):
        return [
            {"id": 1, "name": "Good Event", "slug": "good-event", "start_time": 100, "end_time": 9999999999},
            {"id": None, "name": "Bad Event"},  # null id -> NOT NULL constraint violation on flush
        ]

    monkeypatch.setattr(IGDBClient, "get_upcoming_events", fake_get_upcoming_events)

    result = event_sync_jobs.run(lambda: db_session)

    assert result["total"] == 2
    assert result["succeeded"] == 1
    assert result["failed"] == 1
    [event] = db_session.query(Event).all()
    assert event.name == "Good Event"


def test_run_prunes_events_that_have_since_ended(db_session, monkeypatch):
    _configure_igdb(monkeypatch)
    db_session.add(Event(igdb_id=99, name="Long Over", slug="long-over", end_time=1))
    db_session.commit()

    async def fake_get_upcoming_events(self):
        return []

    monkeypatch.setattr(IGDBClient, "get_upcoming_events", fake_get_upcoming_events)

    result = event_sync_jobs.run(lambda: db_session)

    assert result["pruned"] == 1
    assert db_session.query(Event).count() == 0
