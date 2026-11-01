from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.main import IMMUTABLE_CACHE, UploadsStaticFiles, add_security_headers, cache_control_for


def test_cache_control_by_path():
    # Content-hashed build files and UUID-named uploads never change.
    assert cache_control_for("/assets/main-DYkXAIDy.js") == IMMUTABLE_CACHE
    assert cache_control_for("/uploads/covers/3f2a.jpg") == IMMUTABLE_CACHE
    assert cache_control_for("/uploads/accessory-images/3f2a.jpg") == IMMUTABLE_CACHE
    # Everything else outside the API is checked on every load, so a release shows up at once.
    for path in [
        "/",
        "/index.html",
        "/games",
        "/sw.js",
        "/registerSW.js",
        "/manifest.webmanifest",
        "/player-isolated.html",
        "/emulatorjs/data/loader.js",
        "/static/hardware-reference/sony-playstation-5.png",
        "/uploads/roms/x.nes",
        "/uploads/other/x.jpg",
    ]:
        assert cache_control_for(path) == "no-cache", path
    # The API sets its own (ROMs, BIOS and backup downloads send private, no-store).
    assert cache_control_for("/api/games") is None
    assert cache_control_for("/api/roms/1/content/token/game.nes") is None
    assert cache_control_for("/api/export/backup/full/token/backup.zip") is None
    assert cache_control_for("/healthz") is None


def _app_serving(uploads_dir) -> TestClient:
    """The real middleware and /uploads mount, over a scratch folder."""
    app = FastAPI()
    app.middleware("http")(add_security_headers)

    @app.get("/api/private")
    def private() -> JSONResponse:
        return JSONResponse({}, headers={"Cache-Control": "private, no-store"})

    @app.get("/api/plain")
    def plain() -> dict:
        return {}

    app.mount("/uploads", UploadsStaticFiles(directory=uploads_dir), name="uploads")
    return TestClient(app)


def test_uploaded_images_are_cached_for_a_year(tmp_path):
    (tmp_path / "covers").mkdir()
    (tmp_path / "covers" / "abc.jpg").write_bytes(b"jpeg")
    client = _app_serving(tmp_path)

    response = client.get("/uploads/covers/abc.jpg")

    assert response.status_code == 200
    assert response.headers["cache-control"] == IMMUTABLE_CACHE


def test_errors_get_no_cache_header_but_a_304_repeats_it(tmp_path):
    (tmp_path / "covers").mkdir()
    (tmp_path / "covers" / "abc.jpg").write_bytes(b"jpeg")
    (tmp_path / "roms").mkdir()
    (tmp_path / "roms" / "game.nes").write_bytes(b"rom")
    client = _app_serving(tmp_path)

    missing = client.get("/uploads/covers/missing.jpg")
    assert missing.status_code == 404
    assert "cache-control" not in missing.headers

    # ROMs are never served from /uploads, and a refusal isn't cached either.
    rom = client.get("/uploads/roms/game.nes")
    assert rom.status_code == 404
    assert "cache-control" not in rom.headers

    etag = client.get("/uploads/covers/abc.jpg").headers["etag"]
    not_modified = client.get("/uploads/covers/abc.jpg", headers={"If-None-Match": etag})
    # A revalidation repeats what the 200 would have said.
    assert not_modified.status_code == 304
    assert not_modified.headers["cache-control"] == IMMUTABLE_CACHE


def test_api_responses_keep_their_own_cache_header(tmp_path):
    client = _app_serving(tmp_path)

    assert client.get("/api/private").headers["cache-control"] == "private, no-store"
    assert "cache-control" not in client.get("/api/plain").headers


def test_healthz_has_no_cache_header(client):
    assert "cache-control" not in client.get("/healthz").headers
