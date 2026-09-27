import hashlib
import io

import pytest

from app.core.security import create_access_token, create_bios_token
from app.models.catalog import Platform
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.services import emulation_cores
from app.services.emulation_cores import UnplayableReason

LYNX_BIOS = b"LYNXBOOT" * 64


@pytest.fixture()
def lynx_platform(db_session):
    platform = Platform(name="Atari Lynx", slug="lynx")
    db_session.add(platform)
    db_session.commit()
    return platform


@pytest.fixture()
def ps_platform(db_session):
    platform = Platform(name="PlayStation", slug="ps")
    db_session.add(platform)
    db_session.commit()
    return platform


def _upload_bios(client, system, filename, content=LYNX_BIOS):
    return client.post(
        f"/api/emulation/bios/{system}", files={"file": (filename, io.BytesIO(content), "application/octet-stream")}
    )


def _rom_on(auth_client, db_session, game, platform, filename, content=b"\x00" * 64):
    item = LibraryItem(game_id=game.id, platform_id=platform.id, status=LibraryStatus.OWNED, format=MediaFormat.ROM)
    db_session.add(item)
    db_session.commit()
    files = {"file": (filename, io.BytesIO(content), "application/octet-stream")}
    return item, auth_client.post(f"/api/library/{item.id}/roms", files=files).json()["roms"][-1]


def _bios_files(rom_dir):
    bios_dir = rom_dir / "bios"
    return sorted(p.name for p in bios_dir.iterdir()) if bios_dir.exists() else []


def test_bios_routes_require_auth(client):
    assert client.get("/api/emulation/bios").status_code == 401
    assert client.post("/api/emulation/bios/lynx").status_code == 401
    assert client.delete("/api/emulation/bios/1").status_code == 401


def test_bios_listing_describes_every_system(auth_client):
    systems = {s["key"]: s for s in auth_client.get("/api/emulation/bios").json()}

    assert set(systems) == set(emulation_cores.BIOS_SYSTEMS)
    lynx = systems["lynx"]
    assert lynx["required"] is True and lynx["ready"] is False
    assert lynx["systems"] == ["Atari Lynx"]
    assert lynx["acceptedFiles"][0]["filename"] == "lynxboot.img"
    assert systems["psx"]["required"] is False
    assert "Sega CD / Mega-CD" in systems["segacd"]["systems"]


def test_upload_requires_an_accepted_filename(auth_client, _isolate_rom_storage):
    response = _upload_bios(auth_client, "lynx", "my_bios.bin")

    assert response.status_code == 400
    assert "lynxboot.img" in response.json()["detail"]
    assert _bios_files(_isolate_rom_storage) == []
    assert _upload_bios(auth_client, "nope", "lynxboot.img").status_code == 404


def test_upload_matches_the_name_case_insensitively_and_stores_the_expected_name(auth_client, _isolate_rom_storage):
    response = _upload_bios(auth_client, "lynx", "LYNXBOOT.IMG")

    assert response.status_code == 201
    [uploaded] = response.json()["uploadedFiles"]
    assert uploaded["filename"] == "lynxboot.img"
    assert uploaded["md5"] == hashlib.md5(LYNX_BIOS).hexdigest()
    assert uploaded["recognized"] is False  # not the known-good dump
    assert response.json()["ready"] is True
    assert len(_bios_files(_isolate_rom_storage)) == 1


def test_a_known_good_dump_is_recognized(auth_client, monkeypatch):
    system = emulation_cores.BIOS_SYSTEMS["lynx"]
    fake_known = hashlib.md5(b"known").hexdigest()
    patched = emulation_cores.BiosSystem(
        system.key, system.label, (emulation_cores.BiosFileSpec("lynxboot.img", frozenset({fake_known})),), True
    )
    monkeypatch.setitem(emulation_cores.BIOS_SYSTEMS, "lynx", patched)

    [uploaded] = _upload_bios(auth_client, "lynx", "lynxboot.img", b"known").json()["uploadedFiles"]

    assert uploaded["recognized"] is True


def test_reupload_replaces_and_delete_removes(auth_client, _isolate_rom_storage):
    _upload_bios(auth_client, "lynx", "lynxboot.img", b"first")
    first_files = _bios_files(_isolate_rom_storage)
    [uploaded] = _upload_bios(auth_client, "lynx", "lynxboot.img", b"second").json()["uploadedFiles"]

    assert len(_bios_files(_isolate_rom_storage)) == 1 and _bios_files(_isolate_rom_storage) != first_files
    assert auth_client.delete(f"/api/emulation/bios/{uploaded['id']}").status_code == 204
    assert _bios_files(_isolate_rom_storage) == []
    assert auth_client.delete(f"/api/emulation/bios/{uploaded['id']}").status_code == 404


def test_a_required_bios_gates_playability(auth_client, db_session, seed_game, lynx_platform):
    _, rom = _rom_on(auth_client, db_session, seed_game, lynx_platform, "game.lnx")
    assert rom["playable"] is False
    assert rom["unplayableReason"] == "missing_bios"
    assert rom["missingBiosSystem"] == "lynx"
    assert auth_client.post(f"/api/roms/{rom['id']}/play-session").status_code == 409

    _upload_bios(auth_client, "lynx", "lynxboot.img")
    [now] = auth_client.get(f"/api/games/{seed_game.id}/library").json()[0]["roms"]

    assert now["playable"] is True and now["core"] == "handy"


def test_only_satisfying_files_make_a_system_ready():
    assert emulation_cores.resolve_playability("3do", "iso", ready_bios_systems=frozenset())[1] == (
        UnplayableReason.MISSING_BIOS
    )
    kanji = emulation_cores.BIOS_SYSTEMS["3do"].spec_for("panafz1-kanji.bin")
    assert kanji is not None and kanji.satisfies is False


def test_optional_bios_systems_play_without_one(auth_client, db_session, seed_game, ps_platform):
    _, rom = _rom_on(auth_client, db_session, seed_game, ps_platform, "game.chd")

    assert rom["playable"] is True and rom["core"] == "pcsx_rearmed"
    session = auth_client.post(f"/api/roms/{rom['id']}/play-session").json()
    assert session["biosFiles"] == []


def test_play_session_hands_the_player_signed_bios_links(client, auth_client, db_session, seed_game, lynx_platform):
    _upload_bios(auth_client, "lynx", "lynxboot.img")
    _, rom = _rom_on(auth_client, db_session, seed_game, lynx_platform, "game.lnx")

    session = auth_client.post(f"/api/roms/{rom['id']}/play-session").json()

    [bios] = session["biosFiles"]
    assert bios["filename"] == "lynxboot.img"
    assert bios["url"].endswith("/lynxboot.img")
    assert session["isolated"] is False
    client.headers.pop("Authorization", None)
    got = client.get(bios["url"])
    assert got.status_code == 200 and got.content == LYNX_BIOS


def test_bios_link_rejects_bad_tokens(auth_client, test_user):
    [uploaded] = _upload_bios(auth_client, "lynx", "lynxboot.img").json()["uploadedFiles"]
    bios_id = uploaded["id"]
    for token in ["garbage", create_access_token(test_user.id), create_bios_token(test_user.id, bios_id + 1)]:
        url = f"/api/emulation/bios/content/{bios_id}/{token}/lynxboot.img"
        assert auth_client.get(url).status_code == 401


def test_opera_is_told_which_uploaded_bios_to_use(auth_client, db_session, seed_game):
    platform = Platform(name="3DO", slug="3do")
    db_session.add(platform)
    db_session.commit()
    _upload_bios(auth_client, "3do", "panafz1-kanji.bin")  # doesn't satisfy on its own
    _upload_bios(auth_client, "3do", "goldstar.bin")
    _, rom = _rom_on(auth_client, db_session, seed_game, platform, "game.iso")

    session = auth_client.post(f"/api/roms/{rom['id']}/play-session").json()

    assert session["coreOptions"] == {"opera_bios": "goldstar.bin"}
    assert {f["filename"] for f in session["biosFiles"]} == {"goldstar.bin", "panafz1-kanji.bin"}


def test_thread_cores_open_isolated_and_dos_takes_any_archive(auth_client, db_session, seed_game):
    import zipfile

    dos = Platform(name="DOS", slug="dos")
    db_session.add(dos)
    db_session.commit()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as archive:
        archive.writestr("GAME/GAME.EXE", b"MZ")
    item = LibraryItem(
        game_id=seed_game.id, platform_id=dos.id, status=LibraryStatus.OWNED, format=MediaFormat.ABANDONWARE
    )
    db_session.add(item)
    db_session.commit()
    files = {"file": ("game.zip", io.BytesIO(buf.getvalue()), "application/zip")}
    rom = auth_client.post(f"/api/library/{item.id}/roms", files=files).json()["roms"][-1]

    assert rom["playable"] is True and rom["core"] == "dosbox_pure" and rom["isolated"] is True
    assert auth_client.post(f"/api/roms/{rom['id']}/play-session").json()["isolated"] is True


def test_7z_uploads_are_inspected(auth_client, db_session, seed_game, _isolate_rom_storage):
    py7zr = pytest.importorskip("py7zr")
    nes = Platform(name="NES", slug="nes")
    db_session.add(nes)
    db_session.commit()
    buf = io.BytesIO()
    with py7zr.SevenZipFile(buf, "w") as archive:
        archive.writestr(b"NES\x1a" + b"\x00" * 64, "Game (USA).nes")
    _, rom = _rom_on(auth_client, db_session, seed_game, nes, "game.7z", buf.getvalue())

    assert rom["isArchive"] is True and rom["extension"] == "nes" and rom["playable"] is True

    item = LibraryItem(game_id=seed_game.id, platform_id=nes.id, status=LibraryStatus.OWNED, format=MediaFormat.ROM)
    db_session.add(item)
    db_session.commit()
    before = sorted(p.name for p in _isolate_rom_storage.iterdir())
    bad = auth_client.post(
        f"/api/library/{item.id}/roms", files={"file": ("bad.7z", io.BytesIO(b"not 7z"), "application/octet-stream")}
    )
    assert bad.status_code == 400
    assert sorted(p.name for p in _isolate_rom_storage.iterdir()) == before
