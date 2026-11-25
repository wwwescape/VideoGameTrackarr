import io
import json
import time
import zipfile
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.security import create_guide_token, create_rom_token
from app.main import security_headers_for
from app.models.catalog import Game, GameCategory, Platform
from app.models.documents import DocumentSource
from app.models.library import GameDocument
from app.repositories import game_repository
from app.services import document_files

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


def _docx(body_xml: str, extra: dict[str, bytes] | None = None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/'
            'content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.'
            'relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/'
            'word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.'
            'document.main+xml"/></Types>',
        )
        archive.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/'
            '2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/'
            '2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        )
        archive.writestr(
            "word/document.xml",
            '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/'
            f'wordprocessingml/2006/main"><w:body>{body_xml}</w:body></w:document>',
        )
        for name, data in (extra or {}).items():
            archive.writestr(name, data)
    return buf.getvalue()


DOCX = _docx("<w:p><w:r><w:t>Chapter 1 &lt;script&gt;alert(1)&lt;/script&gt;</w:t></w:r></w:p>")


def _upload(client, game_id, filename, content, **data):
    files = {"file": (filename, io.BytesIO(content), "application/octet-stream")}
    return client.post(f"/api/games/{game_id}/guides/file", files=files, data=data)


def _link(client, game_id, url, **body):
    return client.post(f"/api/games/{game_id}/guides/link", json={"url": url, **body})


def _files(guide_dir):
    return sorted(p.name for p in guide_dir.iterdir()) if guide_dir.exists() else []


def _view(client, guide_id):
    return client.get(client.post(f"/api/guides/{guide_id}/view-link").json()["url"])


@pytest.fixture()
def ps2(db_session):
    platform = Platform(name="PlayStation 2", slug="ps2")
    db_session.add(platform)
    db_session.commit()
    return platform


# --- Auth --------------------------------------------------------------------------------


def test_guides_require_auth(client, seed_game):
    assert client.get(f"/api/games/{seed_game.id}/guides").status_code == 401
    assert _link(client, seed_game.id, "https://example.com").status_code == 401


def test_upload_options(auth_client):
    body = auth_client.get("/api/guides/upload-options").json()

    assert body == {
        "maxUploadMb": get_settings().guide_max_upload_mb,
        "extensions": ["pdf", "docx", "md", "markdown", "txt", "jpg", "jpeg", "png", "webp"],
    }


# --- Creating, listing, editing -------------------------------------------------------------


def test_upload_each_format_and_list_guides_before_cheats(auth_client, seed_game, ps2, _isolate_guide_storage):
    assert _upload(auth_client, seed_game.id, "Zelda Walkthrough.pdf", PDF).status_code == 201
    assert _upload(auth_client, seed_game.id, "notes.docx", DOCX, kind="guide").status_code == 201
    assert (
        _upload(auth_client, seed_game.id, "maps.md", b"# Maps\n\n| a | b |\n|---|---|\n| 1 | 2 |\n").status_code == 201
    )
    created = _upload(
        auth_client,
        seed_game.id,
        "codes.txt",
        b"UUDDLRLRBA",
        kind="cheat",
        name="Action Replay",
        platform_id=str(ps2.id),
    )
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Action Replay"
    assert body["kind"] == "cheat"
    assert body["source"] == "file"
    assert body["mediaFormat"] == "txt"
    assert body["sizeBytes"] == 10
    assert body["platformId"] == ps2.id and body["platformName"] == "PlayStation 2"
    assert body["fileMissing"] is False
    assert body["url"] is None and body["domain"] is None

    listed = auth_client.get(f"/api/games/{seed_game.id}/guides").json()
    assert [(g["kind"], g["name"]) for g in listed] == [
        ("guide", "maps"),
        ("guide", "notes"),
        ("guide", "Zelda Walkthrough"),
        ("cheat", "Action Replay"),
    ]
    # PDF and UTF-8 text need no rendered copy; Word and Markdown get sanitised HTML.
    stored = _files(_isolate_guide_storage)
    assert len([f for f in stored if f.endswith(".render.html")]) == 2
    assert len(stored) == 6


def test_create_a_link_defaults_its_name_to_the_host(auth_client, seed_game):
    response = _link(auth_client, seed_game.id, "  https://www.gamefaqs.gamespot.com/ps2/guide  ", kind="cheat")

    assert response.status_code == 201
    body = response.json()
    assert body["source"] == "link"
    assert body["url"] == "https://www.gamefaqs.gamespot.com/ps2/guide"
    assert body["domain"] == "gamefaqs.gamespot.com"
    assert body["name"] == "gamefaqs.gamespot.com"
    assert body["mediaFormat"] is None and body["fileMissing"] is False


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "data:text/html,hi",
        "file:///etc/passwd",
        "ftp://example.com/guide.txt",
        "https://user:pass@example.com/",
        "https://",
        "not a url",
        "https://example.com/" + "a" * 2048,
    ],
)
def test_bad_links_are_refused(auth_client, seed_game, url):
    response = _link(auth_client, seed_game.id, url)

    assert response.status_code in (400, 422)
    assert auth_client.get(f"/api/games/{seed_game.id}/guides").json() == []


def test_create_for_a_missing_game_or_platform(auth_client, seed_game):
    assert _link(auth_client, 999999, "https://example.com").status_code == 404
    assert _upload(auth_client, 999999, "a.pdf", PDF).status_code == 404
    assert _link(auth_client, seed_game.id, "https://example.com", platformId=999999).status_code == 400
    assert _upload(auth_client, seed_game.id, "a.pdf", PDF, kind="walkthrough").status_code == 400


def test_patch_changes_only_what_is_sent_and_clears_the_platform(auth_client, seed_game, ps2):
    guide = _link(auth_client, seed_game.id, "https://example.com", name="Wiki", platformId=ps2.id).json()

    renamed = auth_client.patch(f"/api/guides/{guide['id']}", json={"name": "Fan wiki", "kind": "cheat"}).json()
    assert (renamed["name"], renamed["kind"], renamed["platformId"]) == ("Fan wiki", "cheat", ps2.id)

    cleared = auth_client.patch(f"/api/guides/{guide['id']}", json={"platformId": None}).json()
    assert cleared["platformId"] is None and cleared["name"] == "Fan wiki"

    blank = auth_client.patch(f"/api/guides/{guide['id']}", json={"name": "  "}).json()
    assert blank["name"] == "example.com"

    assert auth_client.patch("/api/guides/999999", json={"name": "x"}).status_code == 404


def test_switching_a_file_to_a_link_and_back(auth_client, seed_game, _isolate_guide_storage):
    guide = _upload(auth_client, seed_game.id, "guide.md", b"# Guide").json()
    assert len(_files(_isolate_guide_storage)) == 2

    as_link = auth_client.patch(f"/api/guides/{guide['id']}", json={"url": "https://example.com/guide"}).json()
    assert as_link["source"] == "link" and as_link["mediaFormat"] is None and as_link["originalFilename"] is None
    assert _files(_isolate_guide_storage) == []

    files = {"file": ("guide.pdf", io.BytesIO(PDF), "application/pdf")}
    as_file = auth_client.put(f"/api/guides/{guide['id']}/file", files=files).json()
    assert as_file["source"] == "file" and as_file["url"] is None and as_file["mediaFormat"] == "pdf"
    assert len(_files(_isolate_guide_storage)) == 1


def test_replacing_a_file_removes_the_old_one_and_a_refused_one_changes_nothing(
    auth_client, seed_game, _isolate_guide_storage
):
    guide = _upload(auth_client, seed_game.id, "guide.docx", DOCX).json()
    before = _files(_isolate_guide_storage)

    bad = {"file": ("guide.pdf", io.BytesIO(b"not a pdf"), "application/pdf")}
    assert auth_client.put(f"/api/guides/{guide['id']}/file", files=bad).status_code == 400
    assert _files(_isolate_guide_storage) == before

    good = {"file": ("guide.txt", io.BytesIO(b"plain"), "text/plain")}
    replaced = auth_client.put(f"/api/guides/{guide['id']}/file", files=good).json()
    assert replaced["mediaFormat"] == "txt" and replaced["originalFilename"] == "guide.txt"
    after = _files(_isolate_guide_storage)
    assert len(after) == 1 and not set(after) & set(before)


def test_delete_removes_the_row_and_its_files(auth_client, seed_game, _isolate_guide_storage):
    guide = _upload(auth_client, seed_game.id, "guide.md", b"# Guide").json()

    assert auth_client.delete(f"/api/guides/{guide['id']}").status_code == 204
    assert auth_client.get(f"/api/games/{seed_game.id}/guides").json() == []
    assert _files(_isolate_guide_storage) == []


# --- What uploads are refused -------------------------------------------------------------


@pytest.mark.parametrize(
    ("filename", "content", "message"),
    [
        ("guide.html", b"<html></html>", "Save it as PDF, or add it as a link"),
        ("guide.HTM", b"<p>hi</p>", "Save it as PDF, or add it as a link"),
        ("guide.mhtml", b"MIME", "Save it as PDF, or add it as a link"),
        ("guide.doc", b"\xd0\xcf\x11\xe0", "Save it as .docx or PDF"),
        ("guide.exe", b"MZ", "Unsupported file type"),
        ("guide", b"text", "Unsupported file type"),
        ("guide.pdf", b"", "empty"),
        ("guide.pdf", b"<html>not a pdf</html>", "valid PDF"),
        ("guide.docx", b"not a zip", "valid Word"),
        ("guide.docx", b"PK\x05\x06" + b"\x00" * 18, "valid Word"),
        ("guide.txt", b"MZ\x00\x00binary", "text file"),
        ("guide.txt", b"  <!DOCTYPE html><html><script>x</script>", "Save it as PDF, or add it as a link"),
        ("guide.md", b"<html><body>hi</body></html>", "Save it as PDF, or add it as a link"),
    ],
)
def test_refused_uploads_leave_nothing_behind(
    auth_client, seed_game, _isolate_guide_storage, filename, content, message
):
    response = _upload(auth_client, seed_game.id, filename, content)

    assert response.status_code == 400
    assert message in response.json()["detail"]
    assert _files(_isolate_guide_storage) == []
    assert auth_client.get(f"/api/games/{seed_game.id}/guides").json() == []


def test_a_docx_missing_its_document_is_refused(auth_client, seed_game, _isolate_guide_storage):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
    response = _upload(auth_client, seed_game.id, "guide.docx", buf.getvalue())

    assert response.status_code == 400
    assert _files(_isolate_guide_storage) == []


def test_a_docx_that_unpacks_too_large_is_refused(auth_client, seed_game, monkeypatch, _isolate_guide_storage):
    monkeypatch.setattr(document_files, "max_upload_bytes", lambda: 4096)
    bomb = _docx("<w:p/>", extra={"word/media/big.bin": b"\x00" * (64 * 1024)})

    response = _upload(auth_client, seed_game.id, "guide.docx", bomb)

    assert response.status_code == 400
    assert "too large once unpacked" in response.json()["detail"]
    assert _files(_isolate_guide_storage) == []


def test_an_upload_over_the_limit_is_413(auth_client, seed_game, monkeypatch, _isolate_guide_storage):
    monkeypatch.setattr(document_files, "max_upload_bytes", lambda: 64)

    response = _upload(auth_client, seed_game.id, "guide.pdf", PDF + b"\x00" * 100)

    assert response.status_code == 413
    assert _files(_isolate_guide_storage) == []


# --- Sanitising ---------------------------------------------------------------------------


def test_the_sanitiser_strips_everything_active():
    dirty = (
        '<h2 id="top" style="color:red" onclick="x()">Title</h2>'
        "<script>alert(1)</script><iframe src='https://evil.test'></iframe><form><input></form>"
        '<a href="javascript:alert(1)">js</a><a href="data:text/html,hi">data</a>'
        '<a href="https://example.com" onmouseover="x()">ok</a><a href="#top">up</a>'
        '<img src="https://tracker.test/pixel.gif" onerror="x()"><img src="data:image/png;base64,AAAA" alt="map">'
        "<table><tr><td colspan='2' class='c'>cell</td></tr></table><!-- comment -->"
    )

    clean = document_files.sanitize_html(dirty)

    for banned in (
        "script",
        "iframe",
        "form",
        "input",
        "onclick",
        "onerror",
        "onmouseover",
        "style=",
        "class=",
        "javascript:",
        "data:text",
        "tracker.test",
        "comment",
    ):
        assert banned not in clean
    assert '<h2 id="guide-top">Title</h2>' in clean
    assert 'href="https://example.com"' in clean and 'rel="noopener noreferrer"' in clean
    assert 'href="#guide-top"' in clean
    assert '<img src="data:image/png;base64,AAAA" alt="map">' in clean
    assert '<td colspan="2">cell</td>' in clean


def test_markdown_headings_get_ids_that_in_page_links_reach():
    html = document_files.render_markdown(
        "[Go to the castle](#castle)\n\n## Castle\n\n## Boss: *Ganon*!\n\n## Castle\n"
    )

    assert 'href="#guide-castle"' in html
    assert '<h2 id="guide-castle">Castle</h2>' in html
    assert '<h2 id="guide-boss-ganon">Boss: <em>Ganon</em>!</h2>' in html
    assert '<h2 id="guide-castle-1">Castle</h2>' in html


def test_markdown_raw_html_becomes_visible_text():
    html = document_files.render_markdown("Hello <script>alert(1)</script> **bold**\n\n<img src=x onerror=y>")

    assert "<script>" not in html and "<img" not in html
    assert "&lt;script&gt;" in html
    assert "<strong>bold</strong>" in html


# --- Signed links and what they serve ------------------------------------------------------


def test_view_and_download_a_word_file(auth_client, seed_game):
    guide = _upload(auth_client, seed_game.id, "Chapter Notes.docx", DOCX, name="Notes <b>").json()

    view = _view(auth_client, guide["id"])
    assert view.status_code == 200
    assert view.headers["content-type"] == "text/html; charset=utf-8"
    assert "<title>Notes &lt;b&gt;</title>" in view.text
    assert "<p>Chapter 1 &lt;script&gt;alert(1)&lt;/script&gt;</p>" in view.text
    assert view.headers["cache-control"] == "private, no-store"
    assert view.headers["x-content-type-options"] == "nosniff"
    assert view.headers["content-security-policy"].startswith("sandbox;")
    assert "default-src 'none'" in view.headers["content-security-policy"]

    url = auth_client.post(f"/api/guides/{guide['id']}/download-link").json()["url"]
    assert url.endswith("/Chapter%20Notes.docx")
    download = auth_client.get(url)
    assert download.status_code == 200
    assert download.content == DOCX
    assert download.headers["content-disposition"].startswith("attachment;")
    assert "wordprocessingml" in download.headers["content-type"]


def test_a_pdf_is_served_inline_without_the_sandbox(auth_client, seed_game):
    guide = _upload(auth_client, seed_game.id, "guide.pdf", PDF).json()

    view = _view(auth_client, guide["id"])

    assert view.status_code == 200
    assert view.content == PDF
    assert view.headers["content-type"] == "application/pdf"
    assert view.headers["content-disposition"].startswith("inline;")
    csp = view.headers["content-security-policy"]
    assert "sandbox" not in csp and "default-src 'none'" in csp and "object-src 'none'" in csp


def test_a_windows_1252_text_file_is_viewed_as_utf8_and_downloaded_as_it_was(auth_client, seed_game):
    original = "Café — boss guide".encode("cp1252")
    guide = _upload(auth_client, seed_game.id, "old.txt", original).json()

    view = _view(auth_client, guide["id"])
    assert view.headers["content-type"] == "text/plain; charset=utf-8"
    assert view.content.decode("utf-8") == "Café — boss guide"
    assert view.headers["content-security-policy"].startswith("sandbox;")

    download = auth_client.get(auth_client.post(f"/api/guides/{guide['id']}/download-link").json()["url"])
    assert download.content == original


def test_links_have_no_file_to_serve(auth_client, seed_game):
    guide = _link(auth_client, seed_game.id, "https://example.com").json()

    assert auth_client.post(f"/api/guides/{guide['id']}/view-link").status_code == 409
    assert auth_client.post(f"/api/guides/{guide['id']}/download-link").status_code == 409


def test_a_missing_file_is_reported_and_not_served(auth_client, seed_game, _isolate_guide_storage):
    guide = _upload(auth_client, seed_game.id, "guide.pdf", PDF).json()
    for path in _isolate_guide_storage.iterdir():
        path.unlink()

    assert auth_client.get(f"/api/games/{seed_game.id}/guides").json()[0]["fileMissing"] is True
    assert auth_client.post(f"/api/guides/{guide['id']}/view-link").status_code == 404


def test_content_links_are_checked(client, auth_client, db_session, seed_game, test_user):
    first = _upload(auth_client, seed_game.id, "a.pdf", PDF).json()
    second = _upload(auth_client, seed_game.id, "b.pdf", PDF).json()
    token = create_guide_token(test_user.id, first["id"], "view")
    client.headers.pop("Authorization", None)

    # A good link needs no Authorization header.
    assert client.get(f"/api/guides/{first['id']}/content/{token}/a.pdf").status_code == 200
    # Another guide's id with this token, a ROM token, garbage, an expired token.
    assert client.get(f"/api/guides/{second['id']}/content/{token}/b.pdf").status_code == 401
    rom_token = create_rom_token(test_user.id, first["id"])
    assert client.get(f"/api/guides/{first['id']}/content/{rom_token}/a.pdf").status_code == 401
    assert client.get(f"/api/guides/{first['id']}/content/garbage/a.pdf").status_code == 401
    settings = get_settings()
    now = datetime.now(UTC)
    expired = jwt.encode(
        {
            "sub": str(test_user.id),
            "type": "guide",
            "guide": first["id"],
            "mode": "view",
            "iat": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    assert client.get(f"/api/guides/{first['id']}/content/{expired}/a.pdf").status_code == 401
    bad_mode = jwt.encode(
        {
            "sub": str(test_user.id),
            "type": "guide",
            "guide": first["id"],
            "mode": "edit",
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    assert client.get(f"/api/guides/{first['id']}/content/{bad_mode}/a.pdf").status_code == 401
    # A deleted user's links stop working.
    db_session.delete(test_user)
    db_session.commit()
    assert client.get(f"/api/guides/{first['id']}/content/{token}/a.pdf").status_code == 401


def test_the_guide_content_path_gets_the_sandbox_policy():
    csp = security_headers_for("/api/guides/7/content/tok/file.html")["Content-Security-Policy"]
    assert csp.startswith("sandbox;")
    assert security_headers_for("/api/guides/7/view-link")["Content-Security-Policy"].startswith("default-src 'self'")
    assert security_headers_for("/api/games/7/guides")["Content-Security-Policy"].startswith("default-src 'self'")


def test_the_uploads_mount_never_serves_guides(auth_client, tmp_path, monkeypatch):
    from app.main import app

    uploads_dir = tmp_path / "uploads"
    (uploads_dir / "guides").mkdir(parents=True)
    (uploads_dir / "guides" / "abc.pdf").write_bytes(PDF)
    mount = next(r for r in app.routes if getattr(r, "name", None) == "uploads")
    monkeypatch.setattr(mount.app, "directory", uploads_dir)
    monkeypatch.setattr(mount.app, "all_directories", [uploads_dir])

    assert auth_client.get("/uploads/guides/abc.pdf").status_code == 404
    assert auth_client.get("/uploads/GUIDES/abc.pdf").status_code == 404


# --- Deleting games, merging, Danger Zone --------------------------------------------------


def test_deleting_a_game_removes_its_guides_and_files(auth_client, db_session, seed_game, _isolate_guide_storage):
    _upload(auth_client, seed_game.id, "guide.md", b"# Guide")
    _link(auth_client, seed_game.id, "https://example.com")

    assert auth_client.delete(f"/api/games/{seed_game.id}").status_code == 204
    assert db_session.query(GameDocument).count() == 0
    assert _files(_isolate_guide_storage) == []


def test_files_stay_when_the_game_delete_rolls_back(auth_client, db_session, seed_game, _isolate_guide_storage):
    _upload(auth_client, seed_game.id, "guide.pdf", PDF)
    game = db_session.get(Game, seed_game.id)

    game_repository.delete_game_with_addons(db_session, game)
    db_session.rollback()
    db_session.commit()  # a later commit mustn't delete them either

    assert db_session.query(GameDocument).count() == 1
    assert len(_files(_isolate_guide_storage)) == 1


def test_merging_a_game_moves_its_guides(auth_client, db_session, seed_game):
    _link(auth_client, seed_game.id, "https://example.com")
    target = Game(igdb_id=2002, name="Target", slug="target", category=GameCategory.MAIN_GAME)
    db_session.add(target)
    db_session.commit()

    game_repository.merge_game(db_session, source=db_session.get(Game, seed_game.id), target=target)
    db_session.commit()

    assert [g.game_id for g in db_session.query(GameDocument)] == [target.id]


def test_danger_zone_clear_guides(auth_client, db_session, seed_game, _isolate_guide_storage):
    _upload(auth_client, seed_game.id, "guide.docx", DOCX)
    _link(auth_client, seed_game.id, "https://example.com")
    (_isolate_guide_storage / "stray.pdf").write_bytes(PDF)

    response = auth_client.post("/api/danger-zone/clear_guides", json={})

    assert response.status_code == 200
    assert response.json()["removed"] == {"guides": 2}
    assert db_session.query(GameDocument).count() == 0
    assert _files(_isolate_guide_storage) == []
    # The game itself stays.
    assert db_session.get(Game, seed_game.id) is not None


def test_danger_zone_reset_library_removes_guide_files(auth_client, db_session, seed_game, _isolate_guide_storage):
    _upload(auth_client, seed_game.id, "guide.pdf", PDF)

    response = auth_client.post("/api/danger-zone/reset_library", json={"confirmation": "RESET"})

    assert response.status_code == 200
    assert db_session.query(GameDocument).count() == 0
    assert _files(_isolate_guide_storage) == []


# --- Backups ------------------------------------------------------------------------------


def _wait_for_restore(client, timeout: float = 5.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        body = client.get("/api/import/backup/status").json()
        if body["status"] != "running":
            client.post("/api/import/backup/status/acknowledge")
            return body
        time.sleep(0.02)
    raise AssertionError("Restore did not finish within the test timeout")


def _zip_backup(client, guides: bool) -> bytes:
    url = client.post(
        "/api/export/backup/full-link", json={"roms": False, "bios": False, "images": False, "guides": guides}
    ).json()["url"]
    response = client.get(url)
    assert response.status_code == 200
    return response.content


def _restore(client, data: bytes, name: str):
    response = client.post("/api/import/backup", files={"file": (name, io.BytesIO(data), "application/octet-stream")})
    assert response.status_code == 202
    return _wait_for_restore(client)


def _populate(client, game_id):
    pdf = _upload(client, game_id, "guide.pdf", PDF).json()
    md = _upload(client, game_id, "maps.md", b"# Maps").json()
    link = _link(client, game_id, "https://example.com/wiki", kind="cheat").json()
    return pdf, md, link


def test_a_zip_with_guides_round_trips_and_rebuilds_rendered_copies(
    auth_client, db_session, seed_game, _isolate_guide_storage
):
    pdf, md, link = _populate(auth_client, seed_game.id)
    data = _zip_backup(auth_client, guides=True)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        members = [n for n in archive.namelist() if n.startswith("files/guides/")]
    # Originals only, never a rendered copy.
    assert len(members) == 2 and not any(".render." in n for n in members)

    for path in _isolate_guide_storage.iterdir():
        path.unlink()
    status = _restore(auth_client, data, "videogametrackarr-backup.zip")

    assert status["status"] == "completed"
    assert status["result"]["restoredGuideFiles"] == 2
    db_session.expire_all()
    listed = auth_client.get(f"/api/games/{seed_game.id}/guides").json()
    assert {g["id"] for g in listed} == {pdf["id"], md["id"], link["id"]}
    assert not any(g["fileMissing"] for g in listed)
    assert next(g for g in listed if g["id"] == link["id"])["url"] == "https://example.com/wiki"
    assert len([f for f in _files(_isolate_guide_storage) if f.endswith(".render.html")]) == 1
    assert '<h1 id="guide-maps">Maps</h1>' in _view(auth_client, md["id"]).text


def test_a_zip_without_guides_keeps_rows_and_marks_absent_files_missing(
    auth_client, db_session, seed_game, _isolate_guide_storage
):
    _populate(auth_client, seed_game.id)
    data = _zip_backup(auth_client, guides=False)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        assert not [n for n in archive.namelist() if n.startswith("files/guides/")]

    for path in _isolate_guide_storage.iterdir():
        path.unlink()
    status = _restore(auth_client, data, "videogametrackarr-backup.zip")

    assert status["status"] == "completed"
    listed = auth_client.get(f"/api/games/{seed_game.id}/guides").json()
    assert sorted(g["fileMissing"] for g in listed) == [False, True, True]


def test_a_json_restore_on_the_same_instance_keeps_files_and_drops_orphans(
    auth_client, db_session, seed_game, _isolate_guide_storage
):
    pdf, md, _link_guide = _populate(auth_client, seed_game.id)
    data = auth_client.get("/api/export/backup").content
    # Added after the backup: its row and file go on restore.
    _upload(auth_client, seed_game.id, "later.pdf", PDF)

    status = _restore(auth_client, data, "videogametrackarr-backup.json")

    assert status["status"] == "completed"
    listed = auth_client.get(f"/api/games/{seed_game.id}/guides").json()
    assert len(listed) == 3 and not any(g["fileMissing"] for g in listed)
    # The PDF, the Markdown original and its rebuilt render; later.pdf's file is gone.
    assert len(_files(_isolate_guide_storage)) == 3


def test_an_older_backup_without_guides_still_restores(auth_client, db_session, seed_game):
    data = auth_client.get("/api/export/backup").json()
    data.pop("guides", None)

    status = _restore(auth_client, json.dumps(data).encode(), "old-backup.json")

    assert status["status"] == "completed"
    assert db_session.query(GameDocument).count() == 0


def test_a_hand_edited_backup_cannot_point_outside_the_guide_folder(auth_client, db_session, seed_game):
    _upload(auth_client, seed_game.id, "guide.pdf", PDF)
    data = auth_client.get("/api/export/backup").json()
    data["guides"][0]["stored_filename"] = "../../evil.pdf"

    status = _restore(auth_client, json.dumps(data).encode(), "edited.json")

    assert status["status"] == "completed"
    assert db_session.query(GameDocument).filter(GameDocument.source == DocumentSource.FILE).count() == 0
