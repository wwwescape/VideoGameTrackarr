import hashlib
import io
import json
import time
import zipfile

import pytest

from app.models.catalog import Platform
from app.models.library import BiosFile, LibraryItem, LibraryStatus, MediaFormat, RomFile, RomSaveState
from app.services import backup_service

NES_ROM = b"NES\x1a" + b"\x00" * 64
LYNX_BIOS = b"LYNXBOOT" * 64


@pytest.fixture(autouse=True)
def _scratch_backups_dir(monkeypatch, tmp_path):
    monkeypatch.setattr(backup_service, "BACKUPS_DIR", tmp_path / "backups")


@pytest.fixture()
def nes_item(db_session, seed_game):
    platform = Platform(name="Nintendo Entertainment System", slug="nes")
    db_session.add(platform)
    db_session.commit()
    item = LibraryItem(
        game_id=seed_game.id, platform_id=platform.id, status=LibraryStatus.OWNED, format=MediaFormat.ROM
    )
    db_session.add(item)
    db_session.commit()
    return item


def _hashes(rom_dir):
    if not rom_dir.exists():
        return {}
    return {
        str(p.relative_to(rom_dir)).replace("\\", "/"): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in rom_dir.rglob("*")
        if p.is_file()
    }


def _wait(client, timeout: float = 5.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        body = client.get("/api/import/backup/status").json()
        if body["status"] != "running":
            client.post("/api/import/backup/status/acknowledge")
            return body
        time.sleep(0.02)
    raise AssertionError("Restore did not finish within the test timeout")


def _restore_zip(client, data: bytes, name="videogametrackarr-full-backup.zip"):
    return client.post("/api/import/backup", files={"file": (name, io.BytesIO(data), "application/zip")})


def _populate(client, item):
    files = {"file": ("Game (USA).nes", io.BytesIO(NES_ROM), "application/octet-stream")}
    rom = client.post(f"/api/library/{item.id}/roms", files=files, data={"label": "USA"}).json()["roms"][-1]
    state = client.post(
        f"/api/roms/{rom['id']}/states",
        files={
            "state": ("s.state", io.BytesIO(b"STATE"), "application/octet-stream"),
            "screenshot": ("s.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 16), "image/png"),
        },
    ).json()
    sram = {"save": ("g.srm", io.BytesIO(b"SRAM"), "application/octet-stream")}
    client.put(f"/api/roms/{rom['id']}/sram", files=sram)
    client.post("/api/emulation/bios/lynx", files={"file": ("lynxboot.img", io.BytesIO(LYNX_BIOS), "x/y")})
    return rom, state


def test_plain_export_leaves_files_out(auth_client, nes_item):
    _populate(auth_client, nes_item)

    body = auth_client.get("/api/export/backup").json()

    assert body["version"] == 2
    assert body["rom_files"] == [] and body["rom_save_states"] == [] and body["bios_files"] == []


def test_full_backup_round_trip(auth_client, db_session, nes_item, _isolate_rom_storage):
    rom, state = _populate(auth_client, nes_item)
    before = _hashes(_isolate_rom_storage)
    assert len(before) == 5  # ROM, state, screenshot, SRAM, BIOS

    response = auth_client.get("/api/export/backup?full=true")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        names = set(archive.namelist())
        manifest = json.loads(archive.read("backup.json"))
    assert names == {"backup.json", *(f"files/{name}" for name in before)}
    assert [r["label"] for r in manifest["rom_files"]] == ["USA"]

    # Lose everything: the copy (with its ROM + saves) and the BIOS.
    auth_client.delete(f"/api/library/{nes_item.id}")
    bios_id = auth_client.get("/api/emulation/bios").json()
    [lynx] = [s for s in bios_id if s["key"] == "lynx"]
    auth_client.delete(f"/api/emulation/bios/{lynx['uploadedFiles'][0]['id']}")
    assert _hashes(_isolate_rom_storage) == {}

    assert _restore_zip(auth_client, response.content).status_code == 202
    status = _wait(auth_client)

    assert status["status"] == "completed", status
    assert status["result"]["restoredRoms"] == 1
    assert _hashes(_isolate_rom_storage) == before
    db_session.expire_all()
    [restored] = auth_client.get(f"/api/games/{nes_item.game_id}/library").json()[0]["roms"]
    assert restored["id"] == rom["id"] and restored["label"] == "USA"
    assert restored["saveStateCount"] == 1 and restored["hasInGameSave"] is True
    data = auth_client.get(f"/api/roms/{rom['id']}/states/{state['id']}/data")
    assert data.content == b"STATE"
    assert auth_client.get(f"/api/roms/{rom['id']}/sram").content == b"SRAM"
    [lynx] = [s for s in auth_client.get("/api/emulation/bios").json() if s["key"] == "lynx"]
    assert lynx["ready"] is True


def test_full_restore_replaces_files_the_backup_does_not_have(auth_client, db_session, nes_item, _isolate_rom_storage):
    _populate(auth_client, nes_item)
    backup = auth_client.get("/api/export/backup?full=true").content
    before = _hashes(_isolate_rom_storage)
    extra = {"file": ("second.nes", io.BytesIO(NES_ROM + b"2"), "application/octet-stream")}
    auth_client.post(f"/api/library/{nes_item.id}/roms", files=extra)
    assert len(_hashes(_isolate_rom_storage)) == 6

    _restore_zip(auth_client, backup)

    assert _wait(auth_client)["status"] == "completed"
    assert _hashes(_isolate_rom_storage) == before
    db_session.expire_all()
    assert db_session.query(RomFile).count() == 1


def test_json_restore_keeps_bios_and_matching_roms(auth_client, db_session, nes_item, _isolate_rom_storage):
    _populate(auth_client, nes_item)
    before = _hashes(_isolate_rom_storage)
    raw = auth_client.get("/api/export/backup").content

    auth_client.post("/api/import/backup", files={"file": ("backup.json", io.BytesIO(raw), "application/json")})

    assert _wait(auth_client)["status"] == "completed"
    assert _hashes(_isolate_rom_storage) == before
    db_session.expire_all()
    assert db_session.query(BiosFile).count() == 1
    assert db_session.query(RomSaveState).count() == 1


def test_a_version_1_backup_still_restores(auth_client, db_session, seed_game):
    payload = json.loads(auth_client.get("/api/export/backup").content)
    payload["version"] = 1
    for key in ("rom_files", "rom_save_states", "bios_files"):
        payload.pop(key)

    raw = json.dumps(payload).encode()
    auth_client.post("/api/import/backup", files={"file": ("backup.json", io.BytesIO(raw), "application/json")})

    assert _wait(auth_client)["status"] == "completed"


def test_zip_without_backup_json_is_rejected(auth_client, tmp_path):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as archive:
        archive.writestr("files/whatever", b"x")

    response = _restore_zip(auth_client, buf.getvalue())

    assert response.status_code == 400
    assert "backup.json" in response.json()["detail"]
    assert _restore_zip(auth_client, b"PK\x03\x04 not really").status_code == 400


def test_a_zip_missing_a_referenced_file_fails_without_touching_data(
    auth_client, db_session, nes_item, _isolate_rom_storage
):
    _populate(auth_client, nes_item)
    before = _hashes(_isolate_rom_storage)
    full = zipfile.ZipFile(io.BytesIO(auth_client.get("/api/export/backup?full=true").content))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as archive:
        archive.writestr("backup.json", full.read("backup.json"))  # but none of the files

    _restore_zip(auth_client, buf.getvalue())
    status = _wait(auth_client)

    assert status["status"] == "failed" and "missing" in status["error"]
    assert _hashes(_isolate_rom_storage) == before
    db_session.expire_all()
    assert db_session.query(RomFile).count() == 1 and db_session.query(BiosFile).count() == 1


def test_full_backup_download_link(client, auth_client, test_user, nes_item):
    from app.core.security import create_access_token

    url = auth_client.post("/api/export/backup/full-link").json()["url"]
    client.headers.pop("Authorization", None)
    assert client.post("/api/export/backup/full-link").status_code == 401

    response = client.get(url)

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        assert "backup.json" in archive.namelist()
    bad = f"/api/export/backup/full/{create_access_token(test_user.id)}/x.zip"
    assert client.get(bad).status_code == 401
