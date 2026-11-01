from fastapi import FastAPI
from fastapi.responses import FileResponse, Response
from fastapi.testclient import TestClient

from app.main import SelectiveGZipMiddleware
from tests.perf_helpers import seed_library

TEXT = b"compressible text " * 500


def test_large_json_is_gzipped(auth_client, db_session):
    seed_library(db_session, 10)

    plain = auth_client.get("/api/games", headers={"Accept-Encoding": "identity"})
    zipped = auth_client.get("/api/games", headers={"Accept-Encoding": "gzip"})

    assert "content-encoding" not in plain.headers
    assert zipped.headers["content-encoding"] == "gzip"
    assert "Accept-Encoding" in zipped.headers["vary"]
    assert int(zipped.headers["content-length"]) < len(plain.content)
    # The body a client decodes is exactly the uncompressed response.
    assert zipped.json() == plain.json()


def test_small_responses_are_left_alone(client):
    assert "content-encoding" not in client.get("/healthz", headers={"Accept-Encoding": "gzip"}).headers


def _app_serving(tmp_path) -> TestClient:
    """The real middleware over a few stand-in routes."""
    app = FastAPI()
    app.add_middleware(SelectiveGZipMiddleware)
    big_file = tmp_path / "big.txt"
    big_file.write_bytes(TEXT)

    @app.get("/api/text")
    def text() -> Response:
        return Response(TEXT, media_type="text/plain")

    @app.get("/api/binary")
    def binary() -> Response:
        return Response(TEXT, media_type="application/octet-stream")

    @app.get("/api/wasm")
    def wasm() -> Response:
        return Response(TEXT, media_type="application/wasm")

    @app.get("/api/file")
    def file() -> FileResponse:
        return FileResponse(big_file, media_type="text/plain")

    for path in [
        "/emulatorjs/data/loader.js",
        "/api/roms/1/content/token/game.nes",
        "/api/emulation/bios/content/1/token/bios.bin",
        "/api/export/backup/full/token/backup.zip",
    ]:
        app.add_api_route(path, text)
    return TestClient(app)


def test_text_is_gzipped_and_decodes_to_the_same_bytes(tmp_path):
    client = _app_serving(tmp_path)

    response = client.get("/api/text", headers={"Accept-Encoding": "gzip"})

    assert response.headers["content-encoding"] == "gzip"
    assert int(response.headers["content-length"]) < len(TEXT)
    assert response.content == TEXT


def test_binary_and_wasm_are_left_alone(tmp_path):
    client = _app_serving(tmp_path)

    for path in ["/api/binary", "/api/wasm"]:
        response = client.get(path, headers={"Accept-Encoding": "gzip"})
        assert "content-encoding" not in response.headers, path
        assert response.content == TEXT


def test_emulator_rom_bios_and_backup_downloads_are_left_alone(tmp_path):
    client = _app_serving(tmp_path)

    for path in [
        "/emulatorjs/data/loader.js",
        "/api/roms/1/content/token/game.nes",
        "/api/emulation/bios/content/1/token/bios.bin",
        "/api/export/backup/full/token/backup.zip",
    ]:
        response = client.get(path, headers={"Accept-Encoding": "gzip"})
        assert "content-encoding" not in response.headers, path
        assert response.headers["content-length"] == str(len(TEXT)), path


def test_files_are_gzipped_whole_but_ranges_are_not(tmp_path):
    client = _app_serving(tmp_path)

    whole = client.get("/api/file", headers={"Accept-Encoding": "gzip"})
    part = client.get("/api/file", headers={"Accept-Encoding": "gzip", "Range": "bytes=0-9"})

    assert whole.headers["content-encoding"] == "gzip"
    assert whole.content == TEXT
    assert part.status_code == 206
    assert "content-encoding" not in part.headers
    assert part.content == TEXT[:10]
