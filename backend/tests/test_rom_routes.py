import io
import zipfile
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.security import create_access_token, create_rom_token
from app.models.catalog import Platform
from app.models.library import LibraryItem, LibraryStatus, MediaFormat, RomFile
from app.services import backup_service, emulation_cores
from app.services.emulation_cores import UnplayableReason

NES_ROM = b"NES\x1a" + b"\x00" * 64


@pytest.fixture()
def nes_platform(db_session):
    platform = Platform(name="Nintendo Entertainment System", slug="nes")
    db_session.add(platform)
    db_session.commit()
    return platform


@pytest.fixture()
def unsupported_platform(db_session):
    # A platform with no bundled core (Saturn needs a BIOS file — later phase).
    platform = Platform(name="Sega Saturn", slug="saturn")
    db_session.add(platform)
    db_session.commit()
    return platform


def _add_item(db_session, game, platform, fmt=MediaFormat.ROM, status=LibraryStatus.OWNED) -> LibraryItem:
    item = LibraryItem(game_id=game.id, platform_id=platform.id if platform else None, status=status, format=fmt)
    db_session.add(item)
    db_session.commit()
    return item


def _upload(client, item_id, filename="game.nes", content=NES_ROM):
    files = {"file": (filename, io.BytesIO(content), "application/octet-stream")}
    return client.post(f"/api/library/{item_id}/rom", files=files)


def _zip_bytes(entries: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as archive:
        for name, data in entries.items():
            archive.writestr(name, data)
    return buf.getvalue()


def _stored_files(rom_dir):
    return sorted(p.name for p in rom_dir.iterdir()) if rom_dir.exists() else []


# --- resolve_playability -----------------------------------------------------------------


def test_resolve_playability_nes_rom_is_playable():
    core, reason = emulation_cores.resolve_playability("nes", "nes")
    assert core is not None and core.core == "fceumm"
    assert reason is None


def test_resolve_playability_famicom_and_gba():
    assert emulation_cores.resolve_playability("famicom", "NES")[0].core == "fceumm"
    assert emulation_cores.resolve_playability("gba", "gba")[0].core == "mgba"


def test_resolve_playability_unsupported_platform():
    assert emulation_cores.resolve_playability("saturn", "bin") == (None, UnplayableReason.UNSUPPORTED_PLATFORM)
    assert emulation_cores.resolve_playability(None, "nes") == (None, UnplayableReason.UNSUPPORTED_PLATFORM)


def test_resolve_playability_wrong_file_type_for_core():
    assert emulation_cores.resolve_playability("nes", "gba") == (None, UnplayableReason.UNSUPPORTED_FILE_TYPE)
    assert emulation_cores.resolve_playability("nes", "zip") == (None, UnplayableReason.UNSUPPORTED_FILE_TYPE)


# --- upload ------------------------------------------------------------------------------


def test_upload_rom_requires_auth(client, db_session, seed_game, nes_platform):
    item = _add_item(db_session, seed_game, nes_platform)
    assert _upload(client, item.id).status_code == 401


def test_upload_rom_404_for_missing_item(auth_client):
    assert _upload(auth_client, 999999).status_code == 404


def test_upload_nes_rom_is_playable(auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage):
    item = _add_item(db_session, seed_game, nes_platform)

    response = _upload(auth_client, item.id, "Super Game (USA).nes")

    assert response.status_code == 201
    rom = response.json()["rom"]
    assert rom["originalFilename"] == "Super Game (USA).nes"
    assert rom["sizeBytes"] == len(NES_ROM)
    assert rom["extension"] == "nes"
    assert rom["isArchive"] is False
    assert rom["playable"] is True
    assert rom["core"] == "fceumm"
    assert rom["unplayableReason"] is None
    assert len(_stored_files(_isolate_rom_storage)) == 1


def test_library_list_includes_rom_summary(auth_client, db_session, seed_game, nes_platform):
    item = _add_item(db_session, seed_game, nes_platform)
    _upload(auth_client, item.id)
    other = _add_item(db_session, seed_game, nes_platform, fmt=MediaFormat.PHYSICAL)

    items = {i["id"]: i for i in auth_client.get(f"/api/games/{seed_game.id}/library").json()}

    assert items[item.id]["rom"]["playable"] is True
    assert items[other.id]["rom"] is None


def test_upload_unplayable_system_is_stored_but_not_playable(auth_client, db_session, seed_game, unsupported_platform):
    item = _add_item(db_session, seed_game, unsupported_platform)

    response = _upload(auth_client, item.id, "game.bin")

    assert response.status_code == 201
    rom = response.json()["rom"]
    assert rom["playable"] is False
    assert rom["core"] is None
    assert rom["unplayableReason"] == "unsupported_platform"


@pytest.mark.parametrize(
    ("fmt", "status"),
    [
        (MediaFormat.PHYSICAL, LibraryStatus.OWNED),
        (MediaFormat.DIGITAL, LibraryStatus.OWNED),
        (None, LibraryStatus.OWNED),
        (MediaFormat.ROM, LibraryStatus.WISHLIST),
    ],
)
def test_upload_rejected_for_copies_that_cannot_hold_a_rom(
    auth_client, db_session, seed_game, nes_platform, fmt, status
):
    item = _add_item(db_session, seed_game, nes_platform, fmt=fmt, status=status)
    assert _upload(auth_client, item.id).status_code == 400


def test_upload_rejects_extension_not_allowed_for_format(
    auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage
):
    rom_item = _add_item(db_session, seed_game, nes_platform)
    abandonware_item = _add_item(db_session, seed_game, nes_platform, fmt=MediaFormat.ABANDONWARE)
    iso_item = _add_item(db_session, seed_game, nes_platform, fmt=MediaFormat.ISO)

    assert _upload(auth_client, rom_item.id, "virus.exe").status_code == 400
    assert _upload(auth_client, rom_item.id, "noextension").status_code == 400
    assert _upload(auth_client, abandonware_item.id, "game.nes").status_code == 400
    assert _upload(auth_client, iso_item.id, "game.nes").status_code == 400
    assert _upload(auth_client, iso_item.id, "disc.iso").status_code == 201
    assert len(_stored_files(_isolate_rom_storage)) == 1


def test_upload_rejects_empty_file(auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage):
    item = _add_item(db_session, seed_game, nes_platform)
    assert _upload(auth_client, item.id, content=b"").status_code == 400
    assert _stored_files(_isolate_rom_storage) == []


def test_upload_rejects_oversized_file(
    auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage, monkeypatch
):
    monkeypatch.setattr(get_settings(), "rom_max_upload_mb", 1)
    item = _add_item(db_session, seed_game, nes_platform)

    response = _upload(auth_client, item.id, content=b"\x00" * (1024 * 1024 + 1))

    assert response.status_code == 413
    assert _stored_files(_isolate_rom_storage) == []
    db_session.expire_all()
    assert db_session.get(LibraryItem, item.id).rom is None


def test_upload_strips_directory_components_from_filename(auth_client, db_session, seed_game, nes_platform):
    item = _add_item(db_session, seed_game, nes_platform)

    response = _upload(auth_client, item.id, "../../evil/game.nes")

    assert response.status_code == 201
    assert response.json()["rom"]["originalFilename"] == "game.nes"


def test_zip_detects_inner_rom_extension(auth_client, db_session, seed_game, nes_platform):
    item = _add_item(db_session, seed_game, nes_platform)
    content = _zip_bytes({"__MACOSX/._game.nes": b"x", "readme.txt": b"hi", "folder/Game (USA).nes": NES_ROM})

    rom = _upload(auth_client, item.id, "game.zip", content).json()["rom"]

    assert rom["isArchive"] is True
    assert rom["extension"] == "nes"
    assert rom["playable"] is True


def test_abandonware_zip_without_rom_is_stored_but_unplayable(auth_client, db_session, seed_game, nes_platform):
    item = _add_item(db_session, seed_game, nes_platform, fmt=MediaFormat.ABANDONWARE)
    content = _zip_bytes({"GAME/GAME.EXE": b"MZ", "GAME/DATA.DAT": b"x"})

    response = _upload(auth_client, item.id, "game.zip", content)

    assert response.status_code == 201
    rom = response.json()["rom"]
    assert rom["extension"] == "zip"
    assert rom["playable"] is False
    assert rom["unplayableReason"] == "unsupported_file_type"


def test_corrupt_zip_rejected(auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage):
    item = _add_item(db_session, seed_game, nes_platform)
    assert _upload(auth_client, item.id, "game.zip", b"definitely not a zip").status_code == 400
    assert _stored_files(_isolate_rom_storage) == []


def test_reupload_replaces_rom_and_deletes_old_file(
    auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage
):
    item = _add_item(db_session, seed_game, nes_platform)
    first = _upload(auth_client, item.id, "first.nes").json()["rom"]
    first_files = _stored_files(_isolate_rom_storage)

    second = _upload(auth_client, item.id, "second.nes").json()["rom"]

    assert second["id"] == first["id"]
    assert second["originalFilename"] == "second.nes"
    files = _stored_files(_isolate_rom_storage)
    assert len(files) == 1
    assert files != first_files
    assert db_session.query(RomFile).count() == 1


# --- delete + cleanup hooks --------------------------------------------------------------


def test_delete_rom(auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage):
    item = _add_item(db_session, seed_game, nes_platform)
    _upload(auth_client, item.id)

    assert auth_client.delete(f"/api/library/{item.id}/rom").status_code == 204
    assert _stored_files(_isolate_rom_storage) == []
    assert auth_client.delete(f"/api/library/{item.id}/rom").status_code == 404


def test_deleting_library_item_deletes_its_rom(auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage):
    item = _add_item(db_session, seed_game, nes_platform)
    _upload(auth_client, item.id)

    assert auth_client.delete(f"/api/library/{item.id}").status_code == 204
    assert _stored_files(_isolate_rom_storage) == []
    assert db_session.query(RomFile).count() == 0


def test_deleting_game_deletes_its_roms(auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage):
    _upload(auth_client, _add_item(db_session, seed_game, nes_platform).id)
    _upload(auth_client, _add_item(db_session, seed_game, nes_platform).id)
    assert len(_stored_files(_isolate_rom_storage)) == 2

    assert auth_client.delete(f"/api/games/{seed_game.id}").status_code == 204
    assert _stored_files(_isolate_rom_storage) == []
    assert db_session.query(RomFile).count() == 0


@pytest.mark.parametrize("change", [{"format": "physical"}, {"status": "wishlist"}])
def test_changing_copy_so_it_cannot_hold_rom_deletes_rom(
    auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage, change
):
    item = _add_item(db_session, seed_game, nes_platform)
    _upload(auth_client, item.id)

    response = auth_client.put(f"/api/library/{item.id}", json=change)

    assert response.status_code == 200
    assert response.json()["rom"] is None
    assert _stored_files(_isolate_rom_storage) == []


def test_unrelated_copy_edit_keeps_rom(auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage):
    item = _add_item(db_session, seed_game, nes_platform)
    _upload(auth_client, item.id)

    response = auth_client.put(f"/api/library/{item.id}", json={"notes": "cart only", "format": "abandonware"})

    assert response.json()["rom"] is not None
    assert len(_stored_files(_isolate_rom_storage)) == 1


# --- static mount ------------------------------------------------------------------------


def test_uploads_static_mount_refuses_roms_subfolder(
    auth_client, db_session, seed_game, nes_platform, monkeypatch, tmp_path
):
    # Point the real /uploads mount's directory at a tmp dir holding a roms/ file, so this
    # exercises the actual mounted UploadsStaticFiles without touching real uploads.
    from app.main import app

    uploads_dir = tmp_path / "uploads"
    (uploads_dir / "roms").mkdir(parents=True)
    (uploads_dir / "roms" / "abc").write_bytes(NES_ROM)
    (uploads_dir / "covers").mkdir()
    (uploads_dir / "covers" / "c.jpg").write_bytes(b"jpg")
    mount = next(r for r in app.routes if getattr(r, "name", None) == "uploads")
    monkeypatch.setattr(mount.app, "directory", uploads_dir)
    monkeypatch.setattr(mount.app, "all_directories", [uploads_dir])

    assert auth_client.get("/uploads/covers/c.jpg").status_code == 200
    assert auth_client.get("/uploads/roms/abc").status_code == 404
    assert auth_client.get("/uploads/ROMS/abc").status_code == 404
    assert auth_client.get("/uploads/covers/../roms/abc").status_code == 404


# --- play session + content --------------------------------------------------------------


def _play(auth_client, db_session, seed_game, platform, filename="Game (USA).nes"):
    item = _add_item(db_session, seed_game, platform)
    rom = _upload(auth_client, item.id, filename).json()["rom"]
    return rom, auth_client.post(f"/api/roms/{rom['id']}/play-session")


def test_play_session_returns_signed_url(auth_client, db_session, seed_game, nes_platform):
    rom, response = _play(auth_client, db_session, seed_game, nes_platform)

    assert response.status_code == 200
    body = response.json()
    assert body["core"] == "fceumm"
    assert body["gameName"] == f"vgt-rom-{rom['id']}"
    assert body["romUrl"].startswith(f"/api/roms/{rom['id']}/content/")
    assert body["romUrl"].endswith("/Game%20%28USA%29.nes")


def test_play_session_requires_auth(client, db_session, seed_game, nes_platform):
    assert client.post("/api/roms/1/play-session").status_code == 401


def test_play_session_409_for_unplayable_rom(auth_client, db_session, seed_game, unsupported_platform):
    _, response = _play(auth_client, db_session, seed_game, unsupported_platform, "game.bin")
    assert response.status_code == 409


def test_content_served_with_valid_token_without_bearer(client, auth_client, db_session, seed_game, nes_platform):
    _, response = _play(auth_client, db_session, seed_game, nes_platform)
    url = response.json()["romUrl"]
    client.headers.pop("Authorization", None)

    got = client.get(url)
    head = client.head(url)

    assert got.status_code == 200
    assert got.content == NES_ROM
    assert got.headers["cache-control"] == "private, no-store"
    assert head.status_code == 200
    assert head.headers["content-length"] == str(len(NES_ROM))


def test_content_rejects_bad_tokens(auth_client, db_session, seed_game, nes_platform, test_user):
    rom, _ = _play(auth_client, db_session, seed_game, nes_platform)
    rom_id = rom["id"]
    settings = get_settings()
    expired = jwt.encode(
        {"sub": str(test_user.id), "type": "rom", "rom": rom_id, "exp": datetime.now(UTC) - timedelta(minutes=1)},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    for token in [
        "garbage",
        expired,
        create_access_token(test_user.id),  # wrong token type
        create_rom_token(test_user.id, rom_id + 1),  # token for a different ROM
    ]:
        assert auth_client.get(f"/api/roms/{rom_id}/content/{token}/game.nes").status_code == 401


def test_emulation_config(auth_client):
    body = auth_client.get("/api/emulation").json()

    assert body["emulatorjsVersion"] == emulation_cores.EMULATORJS_VERSION

    cores = {c["core"]: c for c in body["cores"]}
    assert cores["fceumm"]["license"] == "GPL-2.0"
    assert cores["mgba"]["license"] == "MPL-2.0"
    assert cores["mgba"]["upstreamUrl"].startswith("https://")
    assert body["allowedUploadExtensions"]["abandonware"] == ["zip"]
    assert "nes" in body["allowedUploadExtensions"]["rom"]
    assert "iso" in body["allowedUploadExtensions"]["iso"]
    assert "physical" not in body["allowedUploadExtensions"]
    assert body["maxUploadMb"] == get_settings().rom_max_upload_mb


def test_emulation_config_requires_auth(client):
    assert client.get("/api/emulation").status_code == 401


# --- backup restore ----------------------------------------------------------------------


def test_restore_keeps_roms_for_matching_copies_and_drops_the_rest(
    auth_client, db_session, seed_game, nes_platform, unsupported_platform, _isolate_rom_storage, monkeypatch, tmp_path
):
    monkeypatch.setattr(backup_service, "BACKUPS_DIR", tmp_path / "backups")
    kept_item = _add_item(db_session, seed_game, nes_platform)
    moved_item = _add_item(db_session, seed_game, nes_platform)
    _upload(auth_client, kept_item.id, "kept.nes")
    _upload(auth_client, moved_item.id, "moved.nes")

    payload = backup_service.build_backup_payload(db_session)
    # Simulate a backup where the second copy was on a different platform.
    for li in payload.library_items:
        if li.id == moved_item.id:
            li.platform_id = unsupported_platform.id

    backup_service.restore_backup(db_session, payload)

    roms = db_session.query(RomFile).all()
    assert [r.library_item_id for r in roms] == [kept_item.id]
    assert roms[0].original_filename == "kept.nes"
    assert _stored_files(_isolate_rom_storage) == [roms[0].stored_filename]


# --- save states + in-game saves (Phase 2) -------------------------------------------------

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def _all_files(rom_dir):
    if not rom_dir.exists():
        return []
    return sorted(str(p.relative_to(rom_dir)).replace("\\", "/") for p in rom_dir.rglob("*") if p.is_file())


def _rom_with_upload(auth_client, db_session, seed_game, platform, fmt=MediaFormat.ROM):
    item = _add_item(db_session, seed_game, platform, fmt=fmt)
    rom = _upload(auth_client, item.id).json()["rom"]
    return item, rom


def _save_state(client, rom_id, state=b"STATE-1", screenshot=PNG_BYTES, screenshot_type="image/png"):
    files = {"state": ("game.state", io.BytesIO(state), "application/octet-stream")}
    if screenshot is not None:
        files["screenshot"] = ("shot.png", io.BytesIO(screenshot), screenshot_type)
    return client.post(f"/api/roms/{rom_id}/states", files=files)


def _put_sram(client, rom_id, data=b"SRAM-1"):
    files = {"save": ("game.srm", io.BytesIO(data), "application/octet-stream")}
    return client.put(f"/api/roms/{rom_id}/sram", files=files)


def test_save_state_create_list_fetch_delete(auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage):
    _, rom = _rom_with_upload(auth_client, db_session, seed_game, nes_platform)

    first = _save_state(auth_client, rom["id"], b"STATE-1")
    second = _save_state(auth_client, rom["id"], b"STATE-2", screenshot=None)

    assert first.status_code == 201
    assert first.json()["hasScreenshot"] is True
    assert first.json()["sizeBytes"] == len(b"STATE-1")
    assert second.json()["hasScreenshot"] is False
    listed = auth_client.get(f"/api/roms/{rom['id']}/states").json()
    assert [s["id"] for s in listed] == [second.json()["id"], first.json()["id"]]  # newest first

    data = auth_client.get(f"/api/roms/{rom['id']}/states/{first.json()['id']}/data")
    assert data.content == b"STATE-1"
    assert data.headers["cache-control"] == "private, no-store"
    shot = auth_client.get(f"/api/roms/{rom['id']}/states/{first.json()['id']}/screenshot")
    assert shot.status_code == 200
    assert shot.headers["content-type"] == "image/png"
    assert auth_client.get(f"/api/roms/{rom['id']}/states/{second.json()['id']}/screenshot").status_code == 404

    assert auth_client.delete(f"/api/roms/{rom['id']}/states/{first.json()['id']}").status_code == 204
    assert [s["id"] for s in auth_client.get(f"/api/roms/{rom['id']}/states").json()] == [second.json()["id"]]
    assert not any(f.endswith(".png") for f in _all_files(_isolate_rom_storage))


def test_save_state_under_wrong_rom_is_404(auth_client, db_session, seed_game, nes_platform):
    _, rom_a = _rom_with_upload(auth_client, db_session, seed_game, nes_platform)
    _, rom_b = _rom_with_upload(auth_client, db_session, seed_game, nes_platform)
    state_id = _save_state(auth_client, rom_a["id"]).json()["id"]

    assert auth_client.get(f"/api/roms/{rom_b['id']}/states/{state_id}/data").status_code == 404
    assert auth_client.delete(f"/api/roms/{rom_b['id']}/states/{state_id}").status_code == 404
    assert auth_client.get("/api/roms/999999/states").status_code == 404


def test_save_state_rejects_bad_screenshot_and_oversize(
    auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage, monkeypatch
):
    from app.services import rom_service

    _, rom = _rom_with_upload(auth_client, db_session, seed_game, nes_platform)
    before = _all_files(_isolate_rom_storage)

    assert _save_state(auth_client, rom["id"], screenshot_type="text/html").status_code == 400
    assert _save_state(auth_client, rom["id"], state=b"").status_code == 400
    monkeypatch.setattr(rom_service, "MAX_STATE_BYTES", 4)
    assert _save_state(auth_client, rom["id"], state=b"12345").status_code == 413
    assert _all_files(_isolate_rom_storage) == before


def test_in_game_save_put_replaces_get_and_delete(
    auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage
):
    _, rom = _rom_with_upload(auth_client, db_session, seed_game, nes_platform)
    assert auth_client.get(f"/api/roms/{rom['id']}/sram").status_code == 404

    assert _put_sram(auth_client, rom["id"], b"SRAM-1").json()["sizeBytes"] == 6
    first_files = [f for f in _all_files(_isolate_rom_storage) if f.startswith("saves/")]
    second = _put_sram(auth_client, rom["id"], b"SRAM-TWO")

    assert second.status_code == 200
    saves = [f for f in _all_files(_isolate_rom_storage) if f.startswith("saves/")]
    assert len(saves) == 1 and saves != first_files
    assert auth_client.get(f"/api/roms/{rom['id']}/sram").content == b"SRAM-TWO"

    assert auth_client.delete(f"/api/roms/{rom['id']}/sram").status_code == 204
    assert not any(f.startswith("saves/") for f in _all_files(_isolate_rom_storage))
    assert auth_client.delete(f"/api/roms/{rom['id']}/sram").status_code == 404


def test_save_routes_require_auth(client):
    assert client.get("/api/roms/1/states").status_code == 401
    assert client.post("/api/roms/1/states").status_code == 401
    assert client.get("/api/roms/1/states/1/data").status_code == 401
    assert client.get("/api/roms/1/states/1/screenshot").status_code == 401
    assert client.delete("/api/roms/1/states/1").status_code == 401
    assert client.get("/api/roms/1/sram").status_code == 401
    assert client.put("/api/roms/1/sram").status_code == 401
    assert client.delete("/api/roms/1/sram").status_code == 401


def test_rom_summary_reports_save_counts(auth_client, db_session, seed_game, nes_platform):
    item, rom = _rom_with_upload(auth_client, db_session, seed_game, nes_platform)
    _save_state(auth_client, rom["id"])
    _save_state(auth_client, rom["id"])
    _put_sram(auth_client, rom["id"])

    listed = next(i for i in auth_client.get(f"/api/games/{seed_game.id}/library").json() if i["id"] == item.id)

    assert listed["rom"]["saveStateCount"] == 2
    assert listed["rom"]["hasInGameSave"] is True


def _add_saves(client, rom_id):
    _save_state(client, rom_id)
    _put_sram(client, rom_id)


def test_replacing_rom_deletes_its_saves(auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage):
    item, rom = _rom_with_upload(auth_client, db_session, seed_game, nes_platform)
    _add_saves(auth_client, rom["id"])

    replaced = _upload(auth_client, item.id, "other.nes").json()["rom"]

    assert replaced["saveStateCount"] == 0
    assert replaced["hasInGameSave"] is False
    files = _all_files(_isolate_rom_storage)
    assert len(files) == 1 and "/" not in files[0]  # only the new ROM file itself


@pytest.mark.parametrize(
    "remove",
    [
        lambda c, item, game: c.delete(f"/api/library/{item.id}/rom"),
        lambda c, item, game: c.delete(f"/api/library/{item.id}"),
        lambda c, item, game: c.delete(f"/api/games/{game.id}"),
        lambda c, item, game: c.put(f"/api/library/{item.id}", json={"format": "physical"}),
    ],
    ids=["delete-rom", "delete-copy", "delete-game", "format-change"],
)
def test_every_rom_removal_path_deletes_saves(
    auth_client, db_session, seed_game, nes_platform, _isolate_rom_storage, remove
):
    from app.models.library import RomSaveState

    item, rom = _rom_with_upload(auth_client, db_session, seed_game, nes_platform)
    _add_saves(auth_client, rom["id"])
    assert len(_all_files(_isolate_rom_storage)) == 4  # rom + state + screenshot + in-game save

    assert remove(auth_client, item, seed_game).status_code in (200, 204)

    assert _all_files(_isolate_rom_storage) == []
    db_session.expire_all()
    assert db_session.query(RomSaveState).count() == 0


def test_restore_keeps_saves_of_surviving_rom_with_its_id(
    auth_client, db_session, seed_game, nes_platform, unsupported_platform, _isolate_rom_storage, monkeypatch, tmp_path
):
    from app.models.library import RomSaveState

    monkeypatch.setattr(backup_service, "BACKUPS_DIR", tmp_path / "backups")
    _, kept_rom = _rom_with_upload(auth_client, db_session, seed_game, nes_platform)
    moved_item, moved_rom = _rom_with_upload(auth_client, db_session, seed_game, nes_platform)
    _add_saves(auth_client, kept_rom["id"])
    _add_saves(auth_client, moved_rom["id"])
    kept_state_id = auth_client.get(f"/api/roms/{kept_rom['id']}/states").json()[0]["id"]

    payload = backup_service.build_backup_payload(db_session)
    for li in payload.library_items:
        if li.id == moved_item.id:
            li.platform_id = unsupported_platform.id
    backup_service.restore_backup(db_session, payload)
    db_session.expire_all()

    roms = db_session.query(RomFile).all()
    assert [r.id for r in roms] == [kept_rom["id"]]
    assert roms[0].sram_stored_filename is not None
    assert [s.id for s in db_session.query(RomSaveState).all()] == [kept_state_id]
    assert auth_client.get(f"/api/roms/{kept_rom['id']}/states/{kept_state_id}/data").content == b"STATE-1"
    assert auth_client.get(f"/api/roms/{kept_rom['id']}/sram").content == b"SRAM-1"
    assert len(_all_files(_isolate_rom_storage)) == 4  # the dropped ROM and its saves are gone



# --- Phase 3: more systems ------------------------------------------------------------------

PHASE3_PLAYABLE = [
    ("gb", "gb", "gambatte"),
    ("gbc", "gbc", "gambatte"),
    ("snes", "sfc", "snes9x"),
    ("sfam", "smc", "snes9x"),
    ("n64", "z64", "mupen64plus_next"),
    ("nds", "nds", "melonds"),
    ("virtualboy", "vb", "beetle_vb"),
    ("virtual-boy", "vboy", "beetle_vb"),
    ("genesis", "md", "genesis_plus_gx"),
    ("genesis-slash-megadrive", "bin", "genesis_plus_gx"),
    ("sms", "sms", "genesis_plus_gx"),
    ("mastersystem", "sms", "genesis_plus_gx"),
    ("gamegear", "gg", "genesis_plus_gx"),
    ("sega32", "32x", "picodrive"),
    ("32x", "32x", "picodrive"),
    ("atari2600", "a26", "stella2014"),
    ("atari7800", "a78", "prosystem"),
    ("jaguar", "j64", "virtualjaguar"),
    ("turbografx16--1", "pce", "mednafen_pce"),
    ("turbografx-16", "pce", "mednafen_pce"),
    ("supergrafx", "sgx", "mednafen_pce"),
    ("neo-geo-pocket", "ngp", "mednafen_ngp"),
    ("neo-geo-pocket-color", "ngc", "mednafen_ngp"),
    ("wonderswan", "ws", "mednafen_wswan"),
    ("wonderswan-color", "wsc", "mednafen_wswan"),
]


@pytest.mark.parametrize(("slug", "extension", "core"), PHASE3_PLAYABLE)
def test_phase3_systems_are_playable(slug, extension, core):
    resolved, reason = emulation_cores.resolve_playability(slug, extension)
    assert reason is None
    assert resolved.core == core


@pytest.mark.parametrize(
    ("slug", "extension"),
    [("snes", "nes"), ("gb", "gba"), ("n64", "nds"), ("genesis", "32x"), ("atari2600", "a78")],
)
def test_phase3_wrong_file_type_is_unplayable(slug, extension):
    assert emulation_cores.resolve_playability(slug, extension) == (None, UnplayableReason.UNSUPPORTED_FILE_TYPE)


@pytest.mark.parametrize("slug", ["ps", "playstation", "saturn", "segacd", "3do", "lynx", "arcade", "dos", "psp"])
def test_bios_thread_and_arcade_systems_stay_unplayable(slug):
    assert emulation_cores.resolve_playability(slug, "bin")[1] == UnplayableReason.UNSUPPORTED_PLATFORM


def test_no_platform_slug_maps_to_two_cores():
    seen: dict[str, str] = {}
    for core in emulation_cores.CORES:
        for slug in core.platform_slugs:
            assert slug not in seen, f"{slug} claimed by both {seen[slug]} and {core.core}"
            seen[slug] = core.core


def test_every_core_extension_is_uploadable_as_rom():
    allowed = emulation_cores.ALLOWED_UPLOAD_EXTENSIONS[MediaFormat.ROM]
    for core in emulation_cores.CORES:
        assert core.extensions <= allowed, (core.core, core.extensions - allowed)


def test_emulation_config_flags_only_non_commercial_cores(auth_client):
    cores = {c["core"]: c for c in auth_client.get("/api/emulation").json()["cores"]}

    assert len(cores) == 15
    assert {name for name, c in cores.items() if c["nonCommercial"]} == {"snes9x", "genesis_plus_gx", "picodrive"}


def test_vendored_cores_match_core_map():
    """frontend/scripts/vendor-emulatorjs.mjs must vendor exactly the cores emulation_cores.py
    lists: a listed-but-unvendored core would make EmulatorJS fetch it from its CDN, and a
    vendored-but-unlisted one is dead weight in every build."""
    import re
    from pathlib import Path

    script = Path(__file__).resolve().parents[2] / "frontend" / "scripts" / "vendor-emulatorjs.mjs"
    vendored = set(re.findall(r'core:\s*"([a-z0-9_]+)"', script.read_text(encoding="utf-8")))

    assert vendored == {c.core for c in emulation_cores.CORES}
