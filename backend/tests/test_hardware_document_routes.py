"""Manuals & Documents: hardware and Toys-to-Life documents, image uploads (shared with Guides &
Cheats), the game Manual type and the official manual links from the curated CSVs."""

import io
from pathlib import Path

import pytest
from PIL import Image

from app.core.security import create_document_token, create_guide_token
from app.main import security_headers_for
from app.models.hardware import HardwareDocument, HardwareReferenceEntry, UserDevice
from app.models.library import LibraryStatus
from app.models.toys_to_life import ToysToLifeCopy, ToysToLifeDocument, ToysToLifeItem
from app.repositories import device_repository
from app.services.toys_to_life_lines import get_line
from scripts.import_hardware_reference import import_from_csv
from scripts.import_toys_to_life import import_line

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
GPS_IFD = 0x8825
ORIENTATION = 0x0112


def _jpeg_with_location(size=(40, 20), orientation=6) -> bytes:
    """A JPEG carrying GPS coordinates and an orientation flag, like a phone photo."""
    image = Image.new("RGB", size, (200, 30, 30))
    exif = Image.Exif()
    exif[ORIENTATION] = orientation
    exif[0x010F] = "PhoneMaker"
    exif.get_ifd(GPS_IFD).update({1: "N", 2: (51.0, 30.0, 0.0), 3: "W", 4: (0.0, 7.0, 0.0)})
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", exif=exif.tobytes())
    return buffer.getvalue()


def _image(fmt: str, size=(10, 10), **save) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGBA" if fmt != "JPEG" else "RGB", size, (0, 128, 255, 255)[: 3 if fmt == "JPEG" else 4]).save(
        buffer, fmt, **save
    )
    return buffer.getvalue()


def _upload(client, path, filename, content, **data):
    files = {"file": (filename, io.BytesIO(content), "application/octet-stream")}
    return client.post(path, files=files, data=data)


def _files(folder: Path) -> list[str]:
    return sorted(p.name for p in folder.iterdir()) if folder.exists() else []


@pytest.fixture()
def documents_dir(tmp_path) -> Path:
    return tmp_path / "documents"


@pytest.fixture()
def owned_copy(db_session, seed_device):
    copy = UserDevice(device_id=seed_device.id, status=LibraryStatus.OWNED, serial_number="SN-123")
    db_session.add(copy)
    db_session.commit()
    return copy


@pytest.fixture()
def lego_dimensions(db_session):
    import_line(db_session, get_line("lego-dimensions"))
    db_session.commit()


def _pack(db_session, set_number: str) -> ToysToLifeItem:
    return db_session.query(ToysToLifeItem).filter_by(line="lego-dimensions", set_number=set_number).one()


# --- Hardware documents ---------------------------------------------------------------------


def test_hardware_documents_require_auth(client, seed_device):
    assert client.get(f"/api/devices/{seed_device.id}/documents").status_code == 401


def test_device_link_crud_and_copy(auth_client, seed_device, owned_copy):
    base = f"/api/devices/{seed_device.id}/documents"
    created = auth_client.post(
        f"{base}/link", json={"url": "https://www.playstation.com/manual", "kind": "manual"}
    ).json()
    assert created["ownerType"] == "device" and created["ownerId"] == seed_device.id
    assert created["name"] == "playstation.com" and created["domain"] == "playstation.com"
    assert created["copyId"] is None

    receipt = auth_client.post(
        f"{base}/link", json={"url": "https://shop.example/r/1", "kind": "receipt", "copyId": owned_copy.id}
    ).json()
    assert receipt["copyId"] == owned_copy.id and receipt["copyNumber"] == 1
    assert receipt["copySerialNumber"] == "SN-123"

    listed = auth_client.get(base).json()
    assert [d["kind"] for d in listed] == ["manual", "receipt"]

    cleared = auth_client.patch(f"/api/hardware-documents/{receipt['id']}", json={"copyId": None}).json()
    assert cleared["copyId"] is None and cleared["copyNumber"] is None
    assert auth_client.delete(f"/api/hardware-documents/{created['id']}").status_code == 204
    assert len(auth_client.get(base).json()) == 1


def test_copy_of_another_owner_is_refused(auth_client, db_session, seed_device, seed_accessory, owned_copy):
    response = auth_client.post(
        f"/api/accessories/{seed_accessory.id}/documents/link",
        json={"url": "https://example.com/x", "kind": "warranty", "copyId": owned_copy.id},
    )
    assert response.status_code == 400
    assert auth_client.get("/api/devices/999/documents").status_code == 404
    assert (
        auth_client.post(f"/api/devices/{seed_device.id}/documents/link", json={"url": "x", "kind": "nope"}).status_code
        == 422
    )


def test_device_file_view_download_and_headers(auth_client, seed_device, documents_dir):
    created = _upload(
        auth_client, f"/api/devices/{seed_device.id}/documents/file", "PS5 Manual.pdf", PDF, kind="manual"
    ).json()
    assert created["name"] == "PS5 Manual" and created["mediaFormat"] == "pdf" and not created["fileMissing"]
    assert len(_files(documents_dir)) == 1

    view = auth_client.get(auth_client.post(f"/api/hardware-documents/{created['id']}/view-link").json()["url"])
    assert view.status_code == 200 and view.content == PDF
    assert view.headers["cache-control"] == "private, no-store"
    download_url = auth_client.post(f"/api/hardware-documents/{created['id']}/download-link").json()["url"]
    assert "attachment" in auth_client.get(download_url).headers["content-disposition"]
    assert "sandbox" in security_headers_for(download_url)["Content-Security-Policy"]


def test_tokens_are_scoped_to_their_table(auth_client, db_session, test_user, seed_device, lego_dimensions):
    hardware = _upload(auth_client, f"/api/devices/{seed_device.id}/documents/file", "a.pdf", PDF).json()
    pack = _pack(db_session, "71170")
    toys = _upload(auth_client, f"/api/toys-to-life/items/{pack.id}/documents/file", "b.pdf", PDF).json()
    assert hardware["id"] == toys["id"]  # same id in two tables

    toys_token = create_document_token(test_user.id, "toys_to_life", toys["id"], "view")
    guide_token = create_guide_token(test_user.id, hardware["id"], "view")
    for token in (toys_token, guide_token):
        assert auth_client.get(f"/api/hardware-documents/{hardware['id']}/content/{token}/a.pdf").status_code == 401
    hardware_token = create_document_token(test_user.id, "hardware", hardware["id"], "view")
    assert (
        auth_client.get(f"/api/toys-to-life-documents/{toys['id']}/content/{hardware_token}/b.pdf").status_code == 401
    )
    assert (
        auth_client.get(f"/api/hardware-documents/{hardware['id']}/content/{hardware_token}/a.pdf").status_code == 200
    )


def test_deleting_a_copy_keeps_its_documents(auth_client, db_session, seed_device, owned_copy):
    created = auth_client.post(
        f"/api/devices/{seed_device.id}/documents/link",
        json={"url": "https://example.com/r", "kind": "receipt", "copyId": owned_copy.id},
    ).json()
    assert auth_client.delete(f"/api/user-devices/{owned_copy.id}").status_code == 204
    db_session.expire_all()
    document = db_session.get(HardwareDocument, created["id"])
    assert document is not None and document.user_device_id is None


def test_deleting_a_device_deletes_its_documents_and_files(auth_client, db_session, seed_device, documents_dir):
    _upload(auth_client, f"/api/devices/{seed_device.id}/documents/file", "a.pdf", PDF)
    assert _files(documents_dir)
    device_repository.delete_device(db_session, seed_device)
    db_session.commit()
    assert db_session.query(HardwareDocument).count() == 0
    assert _files(documents_dir) == []


# --- Toys to Life documents -----------------------------------------------------------------


def test_toys_to_life_documents_with_copies(auth_client, db_session, lego_dimensions):
    pack, other = _pack(db_session, "71170"), _pack(db_session, "71201")
    copy = ToysToLifeCopy(item_id=pack.id, status=LibraryStatus.OWNED)
    other_copy = ToysToLifeCopy(item_id=other.id, status=LibraryStatus.OWNED)
    db_session.add_all([copy, other_copy])
    db_session.commit()
    base = f"/api/toys-to-life/items/{pack.id}/documents"

    created = auth_client.post(
        f"{base}/link", json={"url": "https://example.com/r", "kind": "receipt", "copyId": copy.id}
    ).json()
    assert created["itemId"] == pack.id and created["copyNumber"] == 1
    refused = auth_client.post(f"{base}/link", json={"url": "https://example.com/r", "copyId": other_copy.id})
    assert refused.status_code == 400

    assert auth_client.delete(f"/api/toys-to-life/copies/{copy.id}").status_code == 204
    db_session.expire_all()
    assert db_session.get(ToysToLifeDocument, created["id"]).copy_id is None
    assert [d["id"] for d in auth_client.get(base).json()] == [created["id"]]


# --- Images ---------------------------------------------------------------------------------


def test_photo_is_rotated_and_stripped_of_its_location(auth_client, seed_device, documents_dir):
    created = _upload(
        auth_client, f"/api/devices/{seed_device.id}/documents/file", "receipt.JPEG", _jpeg_with_location()
    ).json()
    assert created["mediaFormat"] == "jpg"
    [stored] = _files(documents_dir)
    assert stored.endswith(".jpg")
    with Image.open(documents_dir / stored) as image:
        assert image.size == (20, 40)  # orientation 6 applied
        assert not image.getexif()
        assert "exif" not in image.info and "icc_profile" not in image.info
    assert created["sizeBytes"] == (documents_dir / stored).stat().st_size

    view = auth_client.get(auth_client.post(f"/api/hardware-documents/{created['id']}/view-link").json()["url"])
    assert view.headers["content-type"] == "image/jpeg"
    assert "sandbox" not in view.headers["content-security-policy"]
    assert "inline" in view.headers["content-disposition"]


def test_png_text_chunks_are_dropped(auth_client, seed_device, documents_dir):
    from PIL import PngImagePlugin

    info = PngImagePlugin.PngInfo()
    info.add_text("Comment", "taken at home")
    _upload(auth_client, f"/api/devices/{seed_device.id}/documents/file", "box.png", _image("PNG", pnginfo=info))
    [stored] = _files(documents_dir)
    with Image.open(documents_dir / stored) as image:
        assert "Comment" not in image.info


@pytest.mark.parametrize(
    ("filename", "content", "message"),
    [
        ("logo.svg", b"<svg xmlns='http://www.w3.org/2000/svg'/>", "SVG"),
        ("photo.heic", b"\x00\x00\x00\x18ftypheic", "HEIC"),
        ("anim.gif", _image("GIF"), "Unsupported file type"),
        ("fake.jpg", _image("PNG"), "isn't a valid JPG"),
        ("broken.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 40, "isn't a valid PNG"),
        ("huge.png", _image("PNG", size=(8000, 7000)), "too large"),
        ("anim.webp", None, "Animated"),
    ],
    ids=["svg", "heic", "gif", "png-named-jpg", "broken-png", "huge", "animated-webp"],
)
def test_bad_images_are_refused(auth_client, seed_device, documents_dir, filename, content, message):
    if content is None:
        frames = [Image.new("RGB", (8, 8), color) for color in ("red", "blue")]
        buffer = io.BytesIO()
        frames[0].save(buffer, "WEBP", save_all=True, append_images=frames[1:])
        content = buffer.getvalue()
    response = _upload(auth_client, f"/api/devices/{seed_device.id}/documents/file", filename, content)
    assert response.status_code == 400
    assert message in response.json()["detail"]
    assert _files(documents_dir) == []


# --- Games: Manual type and images ----------------------------------------------------------


def test_game_manuals_and_images(auth_client, seed_game, tmp_path):
    base = f"/api/games/{seed_game.id}/guides"
    auth_client.post(f"{base}/link", json={"url": "https://example.com/m", "kind": "manual", "name": "A manual"})
    auth_client.post(f"{base}/link", json={"url": "https://example.com/c", "kind": "cheat", "name": "Z cheats"})
    photo = _upload(auth_client, f"{base}/file", "map.webp", _image("WEBP"), kind="guide").json()
    assert photo["mediaFormat"] == "webp"
    assert [g["kind"] for g in auth_client.get(base).json()] == ["guide", "cheat", "manual"]
    assert _files(tmp_path / "guides") and not _files(tmp_path / "documents")


# --- Official manual links ------------------------------------------------------------------


def test_reference_import_reads_manual_urls(db_session, tmp_path, capsys):
    path = tmp_path / "x.csv"
    header = (
        "Brand,Family,Generation,Generation (Short),Artefact,Official Name,Category,Type,Release Date,"
        "Discontinued,Compatibility,Summary,Manual URL\n"
    )
    path.write_text(
        header
        + "Sony,PS,PS5,PS5,PS5,Sony PS5,Console,Device,2020,No,PS5,A console.,https://www.playstation.com/m/\n"
        + "Sony,PS,PS5,PS5,Pad,Sony Pad,Controller,Accessory,2020,No,PS5,A pad.,javascript:alert(1)\n"
        + "Sony,PS,PS5,PS5,Cam,Sony Cam,Camera,Accessory,2020,No,PS5,A cam.,\n",
        encoding="utf-8",
    )
    import_from_csv(db_session, path)
    urls = {e.official_name: e.manual_url for e in db_session.query(HardwareReferenceEntry)}
    assert urls == {"Sony PS5": "https://www.playstation.com/m/", "Sony Pad": None, "Sony Cam": None}
    assert "ignoring Manual URL" in capsys.readouterr().out


def test_lego_packs_carry_their_building_instructions(auth_client, db_session, lego_dimensions):
    detail = auth_client.get("/api/toys-to-life/lines/lego-dimensions/items/71170").json()
    assert detail["manualUrl"] == "https://www.lego.com/en-us/service/building-instructions/71170"
    assert auth_client.get("/api/toys-to-life/lines/lego-dimensions/items/71340").json()["manualUrl"] is None


# --- Game copies, Toys-to-Life types --------------------------------------------------------


def test_game_receipt_names_a_library_copy(auth_client, db_session, seed_game, seed_platform):
    from app.models.catalog import Game
    from app.models.library import LibraryItem

    copy = LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED)
    other_game = Game(name="Other", slug="other")
    db_session.add_all([copy, other_game])
    db_session.commit()
    other_copy = LibraryItem(game_id=other_game.id, status=LibraryStatus.OWNED)
    db_session.add(other_copy)
    db_session.commit()
    base = f"/api/games/{seed_game.id}/guides"

    receipt = auth_client.post(
        f"{base}/link", json={"url": "https://shop.example/r", "kind": "receipt", "copyId": copy.id}
    ).json()
    assert receipt["kind"] == "receipt" and receipt["copyId"] == copy.id and receipt["copyNumber"] == 1
    assert receipt["copyPlatformName"] == seed_platform.name
    refused = auth_client.post(f"{base}/link", json={"url": "https://x.example", "copyId": other_copy.id})
    assert refused.status_code == 400

    assert auth_client.delete(f"/api/library/{copy.id}").status_code == 204
    [listed] = auth_client.get(base).json()
    assert listed["id"] == receipt["id"] and listed["copyId"] is None


def test_toys_to_life_offers_only_manual_receipt_and_other(auth_client, db_session, lego_dimensions):
    pack = _pack(db_session, "71170")
    base = f"/api/toys-to-life/items/{pack.id}/documents"
    assert auth_client.post(f"{base}/link", json={"url": "https://a.example", "kind": "warranty"}).status_code == 400
    created = auth_client.post(f"{base}/link", json={"url": "https://a.example", "kind": "other"}).json()
    assert auth_client.patch(f"/api/toys-to-life-documents/{created['id']}", json={"kind": "repair"}).status_code == 400


# --- Backups and Danger Zone ----------------------------------------------------------------


def _wait_for_restore(client) -> dict:
    import time

    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        body = client.get("/api/import/backup/status").json()
        if body["status"] != "running":
            client.post("/api/import/backup/status/acknowledge")
            return body
        time.sleep(0.02)
    raise AssertionError("Restore did not finish")


def test_documents_round_trip_in_a_zip(
    auth_client, db_session, seed_device, owned_copy, lego_dimensions, documents_dir
):
    import zipfile

    device_file = _upload(auth_client, f"/api/devices/{seed_device.id}/documents/file", "manual.pdf", PDF).json()
    receipt = auth_client.post(
        f"/api/devices/{seed_device.id}/documents/link",
        json={"url": "https://shop.example/r", "kind": "receipt", "copyId": owned_copy.id},
    ).json()
    pack = _pack(db_session, "71170")
    db_session.add_all(
        [
            ToysToLifeCopy(item_id=pack.id, status=LibraryStatus.OWNED),
            ToysToLifeCopy(item_id=pack.id, status=LibraryStatus.WISHLIST),
        ]
    )
    db_session.commit()
    second_copy = db_session.query(ToysToLifeCopy).filter_by(item_id=pack.id).order_by(ToysToLifeCopy.id).all()[1]
    toy_file = _upload(
        auth_client,
        f"/api/toys-to-life/items/{pack.id}/documents/file",
        "box.png",
        _image("PNG"),
        kind="other",
        copy_id=second_copy.id,
    ).json()
    assert toy_file["copyNumber"] == 2

    url = auth_client.post(
        "/api/export/backup/full-link",
        json={"roms": False, "bios": False, "images": False, "guides": False, "documents": True},
    ).json()["url"]
    data = auth_client.get(url).content
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        members = sorted(n for n in archive.namelist() if n.startswith("files/documents/"))
    assert len(members) == 2

    for path in documents_dir.iterdir():
        path.unlink()
    response = auth_client.post(
        "/api/import/backup", files={"file": ("backup.zip", io.BytesIO(data), "application/zip")}
    )
    assert response.status_code == 202
    status = _wait_for_restore(auth_client)
    assert status["status"] == "completed", status
    assert status["result"]["restoredDocumentFiles"] == 2

    db_session.expire_all()
    listed = {d["id"]: d for d in auth_client.get(f"/api/devices/{seed_device.id}/documents").json()}
    assert set(listed) == {device_file["id"], receipt["id"]}
    assert listed[receipt["id"]]["copyId"] == owned_copy.id
    assert not listed[device_file["id"]]["fileMissing"]
    pack = _pack(db_session, "71170")
    [toy] = auth_client.get(f"/api/toys-to-life/items/{pack.id}/documents").json()
    assert toy["copyNumber"] == 2 and not toy["fileMissing"]


def test_a_json_restore_keeps_files_that_restored_rows_still_use(auth_client, db_session, seed_device, documents_dir):
    _upload(auth_client, f"/api/devices/{seed_device.id}/documents/file", "manual.pdf", PDF)
    raw = auth_client.get("/api/export/backup").content
    auth_client.post("/api/import/backup", files={"file": ("backup.json", io.BytesIO(raw), "application/json")})
    assert _wait_for_restore(auth_client)["status"] == "completed"
    [document] = auth_client.get(f"/api/devices/{seed_device.id}/documents").json()
    assert not document["fileMissing"]
    assert len(_files(documents_dir)) == 1


def test_clear_documents(auth_client, db_session, seed_device, seed_game, lego_dimensions, documents_dir):
    _upload(auth_client, f"/api/devices/{seed_device.id}/documents/file", "a.pdf", PDF)
    pack = _pack(db_session, "71170")
    auth_client.post(f"/api/toys-to-life/items/{pack.id}/documents/link", json={"url": "https://a.example"})
    auth_client.post(f"/api/games/{seed_game.id}/guides/link", json={"url": "https://g.example"})

    response = auth_client.post("/api/danger-zone/clear_documents", json={})
    assert response.status_code == 200
    assert response.json()["removed"] == {"documents": 2}
    assert _files(documents_dir) == []
    assert len(auth_client.get(f"/api/games/{seed_game.id}/guides").json()) == 1
