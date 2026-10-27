from datetime import UTC, datetime

import pytest

from app.models.catalog import Collection, Game, GameCategory, GameCollection
from app.models.events import Event, EventGame
from app.models.hardware import DeviceNote, DeviceTag, UserAccessory, UserDevice
from app.models.igdb_import import IgdbImportEntry
from app.models.itad import ItadPriceCache
from app.models.library import (
    GameProgress,
    GameTag,
    LibraryItem,
    LibraryStatus,
    Note,
    PlaySession,
    PlayStatus,
    Tag,
)
from app.models.steam import SteamLibraryEntry
from app.services import backup_service


@pytest.fixture(autouse=True)
def scratch_snapshots(monkeypatch, tmp_path):
    backups = tmp_path / "backups"
    monkeypatch.setattr(backup_service, "BACKUPS_DIR", backups)
    return backups


@pytest.fixture()
def library(db_session, seed_game, seed_platform, seed_device, seed_accessory):
    """A game with a copy, progress, a session, a rating, a note and a tag; a device and an
    accessory you own, with a note and a tag; a Collection; an Event listing the game; and
    cache rows, one of them ignored."""
    seed_game.user_rating = 8
    tag = Tag(name="Favourite")
    collection = Collection(igdb_id=500, name="Series One")
    event = Event(igdb_id=900, name="Showcase")
    db_session.add_all([tag, collection, event])
    db_session.flush()
    db_session.add_all(
        [
            LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED),
            GameProgress(game_id=seed_game.id, platform_id=seed_platform.id, play_status=PlayStatus.PLAYING),
            PlaySession(
                game_id=seed_game.id, platform_id=seed_platform.id, started_at=datetime(2026, 1, 1, tzinfo=UTC)
            ),
            Note(game_id=seed_game.id, body="game note"),
            GameTag(game_id=seed_game.id, tag_id=tag.id),
            GameCollection(game_id=seed_game.id, collection_id=collection.id),
            EventGame(event_id=event.id, igdb_game_id=seed_game.igdb_id, game_id=seed_game.id),
            UserDevice(device_id=seed_device.id, status=LibraryStatus.OWNED),
            UserAccessory(accessory_id=seed_accessory.id, status=LibraryStatus.OWNED),
            DeviceNote(device_id=seed_device.id, body="device note"),
            DeviceTag(device_id=seed_device.id, tag_id=tag.id),
            SteamLibraryEntry(steam_app_id=10, steam_name="Matched", game_id=seed_game.id),
            SteamLibraryEntry(steam_app_id=11, steam_name="Ignored", dismissed=True),
            ItadPriceCache(game_id=seed_game.id, ignored=True),
        ]
    )
    db_session.commit()
    return seed_game


def _run(client, action: str, confirmation: str | None = None):
    return client.post(f"/api/danger-zone/{action}", json={"confirmation": confirmation})


def _counts(db_session) -> dict[str, int]:
    db_session.expire_all()
    return {
        "games": db_session.query(Game).count(),
        "copies": db_session.query(LibraryItem).count(),
        "progress": db_session.query(GameProgress).count(),
        "sessions": db_session.query(PlaySession).count(),
        "notes": db_session.query(Note).count() + db_session.query(DeviceNote).count(),
        "tags": db_session.query(Tag).count(),
        "devices": db_session.query(UserDevice).count(),
        "accessories": db_session.query(UserAccessory).count(),
        "rated": db_session.query(Game).filter(Game.user_rating.is_not(None)).count(),
    }


def test_clear_progress_removes_progress_and_sessions_only(auth_client, db_session, library):
    response = _run(auth_client, "clear_progress")

    assert response.status_code == 200
    assert response.json() == {"removed": {"progress": 1, "playSessions": 1}, "safetySnapshotPath": None}
    counts = _counts(db_session)
    assert (counts["progress"], counts["sessions"]) == (0, 0)
    assert (counts["copies"], counts["rated"], counts["notes"]) == (1, 1, 2)


def test_clear_ratings_notes_and_tags_each_touch_only_their_kind(auth_client, db_session, library):
    assert _run(auth_client, "clear_ratings").json()["removed"] == {"ratings": 1}
    assert _counts(db_session)["rated"] == 0

    assert _run(auth_client, "clear_notes").json()["removed"] == {"notes": 2}
    assert _counts(db_session)["notes"] == 0

    assert _run(auth_client, "clear_tags").json()["removed"] == {"tags": 1}
    counts = _counts(db_session)
    assert counts["tags"] == 0
    assert db_session.query(GameTag).count() == 0 and db_session.query(DeviceTag).count() == 0
    assert (counts["games"], counts["copies"], counts["progress"]) == (1, 1, 1)


def test_clear_sync_caches_keeps_what_you_ignored(auth_client, db_session, library):
    db_session.add(IgdbImportEntry(game_id=library.id, exact_match_count=0))
    db_session.commit()

    response = _run(auth_client, "clear_sync_caches")

    assert response.json()["removed"] == {"cacheEntries": 2}
    db_session.expire_all()
    assert [e.steam_name for e in db_session.query(SteamLibraryEntry)] == ["Ignored"]
    assert db_session.query(ItadPriceCache).one().ignored is True
    assert db_session.query(IgdbImportEntry).count() == 0
    assert _counts(db_session)["games"] == 1


@pytest.mark.parametrize("action", ["reset_library", "reset_hardware", "reset_everything"])
def test_a_reset_needs_reset_typed_and_changes_nothing_without_it(auth_client, db_session, library, action):
    before = _counts(db_session)

    for confirmation in (None, "reset", "yes"):
        assert _run(auth_client, action, confirmation).status_code == 409

    assert _counts(db_session) == before


def test_reset_library_removes_every_game_and_keeps_hardware(auth_client, db_session, library, scratch_snapshots):
    response = _run(auth_client, "reset_library", "RESET")

    assert response.status_code == 200
    body = response.json()
    assert body["removed"] == {"games": 1}
    # A safety snapshot of everything as it was, restorable like any backup.
    snapshot = scratch_snapshots / body["safetySnapshotPath"].replace("\\", "/").split("/")[-1]
    assert snapshot.name.startswith("pre-reset-reset_library-") and snapshot.is_file()
    assert len(backup_service.parse_backup_payload(snapshot.read_text(encoding="utf-8")).games) == 1
    counts = _counts(db_session)
    assert (counts["games"], counts["copies"], counts["progress"], counts["sessions"]) == (0, 0, 0, 0)
    assert db_session.query(Collection).count() == 0
    # The event stays, just no longer linked to a game here; hardware and tags stay.
    assert db_session.query(EventGame).one().game_id is None
    assert (counts["devices"], counts["accessories"], counts["tags"]) == (1, 1, 1)
    assert db_session.query(DeviceNote).count() == 1


def test_reset_hardware_removes_devices_and_accessories_and_keeps_games(auth_client, db_session, library):
    response = _run(auth_client, "reset_hardware", "RESET")

    assert response.json()["removed"] == {"devices": 1, "accessories": 1}
    counts = _counts(db_session)
    assert (counts["devices"], counts["accessories"]) == (0, 0)
    assert db_session.query(DeviceNote).count() == 0 and db_session.query(DeviceTag).count() == 0
    assert (counts["games"], counts["copies"], counts["tags"]) == (1, 1, 1)


def test_reset_everything_keeps_only_the_account(auth_client, db_session, library, test_user):
    response = _run(auth_client, "reset_everything", "RESET")

    assert response.status_code == 200
    counts = _counts(db_session)
    assert all(count == 0 for count in counts.values()), counts
    assert db_session.query(SteamLibraryEntry).count() == 0
    assert db_session.query(ItadPriceCache).count() == 0
    # Still signed in: the account isn't touched.
    assert auth_client.get("/api/auth/me").status_code == 200


def test_an_unknown_action_is_refused(auth_client):
    assert _run(auth_client, "drop_tables").status_code == 422


def test_reset_library_deletes_uploaded_covers_but_not_igdb_ones(auth_client, db_session, monkeypatch, tmp_path):
    from app.services import upload_service

    covers = tmp_path / "covers"
    covers.mkdir()
    (covers / "mine.jpg").write_bytes(b"x")
    (covers / "unrelated.jpg").write_bytes(b"y")
    monkeypatch.setattr(upload_service, "COVERS_DIR", covers)
    db_session.add_all(
        [
            Game(name="Custom", category=GameCategory.MAIN_GAME, cover_url="/uploads/covers/mine.jpg"),
            Game(name="IGDB", igdb_id=42, category=GameCategory.MAIN_GAME, cover_url="https://images.igdb.com/a.jpg"),
            # A cover address with no file name must never delete the covers folder itself.
            Game(name="Odd", category=GameCategory.MAIN_GAME, cover_url="/uploads/covers/"),
        ]
    )
    db_session.commit()

    assert _run(auth_client, "reset_library", "RESET").status_code == 200

    assert not (covers / "mine.jpg").exists()
    assert (covers / "unrelated.jpg").exists() and covers.is_dir()
