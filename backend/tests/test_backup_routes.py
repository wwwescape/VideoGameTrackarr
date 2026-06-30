import io
import json
from pathlib import Path

from app.models.catalog import Game, GameCategory
from app.models.hardware import Device, Manufacturer, UserDevice
from app.models.library import (
    GameProgress,
    GameTag,
    LibraryItem,
    LibraryStatus,
    Note,
    PlayStatus,
    Tag,
)


def _upload_backup(client, payload: dict):
    raw = json.dumps(payload).encode("utf-8")
    return client.post("/api/import/backup", files={"file": ("backup.json", io.BytesIO(raw), "application/json")})


def test_export_backup_requires_auth(client):
    response = client.get("/api/export/backup")

    assert response.status_code == 401


def test_export_backup_contains_every_section(auth_client, db_session, seed_game, seed_platform, seed_region):
    db_session.add(
        LibraryItem(
            game_id=seed_game.id, platform_id=seed_platform.id, region_id=seed_region.id, status=LibraryStatus.OWNED
        )
    )
    db_session.add(GameProgress(game_id=seed_game.id, play_status=PlayStatus.PLAYING, rating=8))
    db_session.add(Note(game_id=seed_game.id, body="a note"))
    tag = Tag(name="Backup Test Tag")
    db_session.add(tag)
    db_session.commit()
    db_session.add(GameTag(game_id=seed_game.id, tag_id=tag.id))
    db_session.commit()

    response = auth_client.get("/api/export/backup")

    assert response.status_code == 200
    assert "attachment" in response.headers["content-disposition"]
    # The backup file's internal keys are snake_case by design, not camelCase -
    # see schemas/backup.py's note on why this file format skips the API convention.
    body = response.json()
    assert body["version"] == 1
    assert len(body["games"]) == 1
    assert len(body["library_items"]) == 1
    assert len(body["game_progress"]) == 1
    assert len(body["notes"]) == 1
    assert len(body["tags"]) == 1
    assert len(body["game_tags"]) == 1


def test_export_backup_contains_hardware_sections(auth_client, db_session, seed_device):
    auth_client.post(f"/api/devices/{seed_device.id}/user-devices", json={"status": "owned"})
    auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Sony",
            "accessoryType": "Controller",
            "officialName": "DualSense",
            "compatiblePlatforms": ["PlayStation 5"],
        },
    )

    response = auth_client.get("/api/export/backup")

    assert response.status_code == 200
    body = response.json()
    assert len(body["manufacturers"]) >= 1
    assert len(body["hardware"]) == 1
    assert len(body["user_hardware"]) == 1
    assert len(body["accessories"]) == 1
    assert len(body["accessory_compatibility"]) == 1


def test_restore_backup_requires_auth(client):
    response = _upload_backup(client, {"version": 1, "exportedAt": "now", "games": []})

    assert response.status_code == 401


def test_restore_backup_replaces_existing_data(auth_client, db_session, seed_game):
    # seed_game exists before the restore; the backup payload doesn't mention it, so a
    # full-replace restore must make it disappear. Keys are snake_case to match the backup
    # file's internal schema (not the camelCase API convention - see schemas/backup.py).
    snake_payload = {
        "version": 1,
        "exported_at": "2026-01-01T00:00:00+00:00",
        "platforms": [{"id": 50, "name": "Sega Saturn"}],
        "regions": [{"id": 60, "name": "PAL"}],
        "tags": [{"id": 70, "name": "Restored Tag", "color": None}],
        "games": [{"id": 100, "igdb_id": None, "name": "Restored Game", "category": "main_game"}],
        "library_items": [
            {
                "id": 200,
                "game_id": 100,
                "platform_id": 50,
                "region_id": 60,
                "status": "owned",
                "format": None,
                "edition": None,
                "acquired_at": None,
                "notes": None,
            }
        ],
        "game_progress": [
            {"id": 300, "game_id": 100, "play_status": "completed", "playtime_minutes": 600, "rating": 9}
        ],
        "play_sessions": [],
        "notes": [{"id": 400, "game_id": 100, "body": "Restored note"}],
        "game_tags": [{"game_id": 100, "tag_id": 70}],
    }

    seed_game_id = seed_game.id
    response = _upload_backup(auth_client, snake_payload)

    assert response.status_code == 200
    body = response.json()
    assert body["restoredGames"] == 1
    assert body["restoredLibraryItems"] == 1
    assert body["safetySnapshotPath"]

    assert db_session.query(Game).filter_by(id=seed_game_id).count() == 0
    restored = db_session.query(Game).filter_by(id=100).one()
    assert restored.name == "Restored Game"
    assert restored.category == GameCategory.MAIN_GAME

    library_item = db_session.query(LibraryItem).filter_by(id=200).one()
    assert library_item.platform.name == "Sega Saturn"
    assert library_item.region.name == "PAL"

    progress = db_session.query(GameProgress).filter_by(game_id=100).one()
    assert progress.play_status == PlayStatus.COMPLETED
    assert progress.rating == 9

    note = db_session.query(Note).filter_by(id=400).one()
    assert note.body == "Restored note"

    tag = db_session.query(Tag).filter_by(id=70).one()
    assert tag.name == "Restored Tag"
    assert db_session.query(GameTag).filter_by(game_id=100, tag_id=70).count() == 1

    Path(body["safetySnapshotPath"]).unlink()


def test_restore_backup_restores_hardware_sections(auth_client, db_session):
    payload = {
        "version": 1,
        "exported_at": "2026-01-01T00:00:00+00:00",
        "manufacturers": [{"id": 10, "name": "Sony"}],
        "hardware_platforms": [{"id": 20, "name": "PlayStation 5"}],
        "hardware_types": [{"id": 30, "name": "Console"}],
        "hardware": [
            {
                "id": 40,
                "uuid": "11111111-1111-1111-1111-111111111111",
                "manufacturer_id": 10,
                "hardware_platform_id": 20,
                "hardware_type_id": 30,
                "official_name": "Sony PlayStation 5",
            }
        ],
        "user_hardware": [{"id": 60, "hardware_id": 40, "status": "owned"}],
    }

    response = _upload_backup(auth_client, payload)

    assert response.status_code == 200

    manufacturer = db_session.query(Manufacturer).filter_by(id=10).one()
    assert manufacturer.name == "Sony"
    device = db_session.query(Device).filter_by(id=40).one()
    assert device.official_name == "Sony PlayStation 5"
    user_device = db_session.query(UserDevice).filter_by(id=60).one()
    assert user_device.status.value == "owned"

    Path(response.json()["safetySnapshotPath"]).unlink()


def test_restore_backup_writes_a_safety_snapshot_of_prior_data(auth_client, seed_game):
    response = _upload_backup(
        auth_client,
        {"version": 1, "exported_at": "now", "games": [], "library_items": []},
    )

    assert response.status_code == 200
    snapshot_path = response.json()["safetySnapshotPath"]

    snapshot = json.loads(Path(snapshot_path).read_text(encoding="utf-8"))
    assert any(g["name"] == seed_game.name for g in snapshot["games"])

    Path(snapshot_path).unlink()


def test_restore_backup_rejects_malformed_file(auth_client):
    response = auth_client.post(
        "/api/import/backup",
        files={"file": ("backup.json", io.BytesIO(b"not json"), "application/json")},
    )

    assert response.status_code == 400


def test_restore_backup_rejects_missing_required_fields(auth_client):
    response = _upload_backup(auth_client, {"games": []})

    assert response.status_code == 400
