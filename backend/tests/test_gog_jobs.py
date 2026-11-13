import gzip

import httpx
import pytest
import respx

from app.models.catalog import Game, GameCategory
from app.models.gog import GogLibraryEntry
from app.repositories import gog_repository
from app.services import gog_jobs
from app.services.gog_client import (
    GOG_AUTH_BASE,
    GogClient,
    GogNotConfiguredError,
    GogOwnedGame,
)
from app.services.igdb_client import EXTERNAL_SOURCE_GOG, IGDBClient


def _configure_gog(test_user, db_session):
    # The refresh token is stored in plaintext on the user row (this codebase
    # has no at-rest encryption for stored secrets).
    test_user.gog_refresh_token = "test-refresh-token"
    db_session.commit()


def _seed_game(db_session, igdb_id: int, name: str) -> Game:
    game = Game(igdb_id=igdb_id, name=name, slug=name.lower().replace(" ", "-"), category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    return game


def test_run_requires_gog_configuration(db_session, test_user):
    # No gog_refresh_token saved on the user.

    with pytest.raises(GogNotConfiguredError):
        gog_jobs.run(lambda: db_session)


def test_run_caches_the_match_for_an_untracked_game(db_session, test_user, monkeypatch):
    game = _seed_game(db_session, igdb_id=233, name="The Witcher 3")
    game_id = game.id  # captured before run() below closes db_session
    _configure_gog(test_user, db_session)

    async def fake_get_owned_library(self):
        return [GogOwnedGame(product_id=1207658695, name="The Witcher 3")]

    async def fake_get_igdb_ids(self, source, uids):
        assert source == EXTERNAL_SOURCE_GOG
        assert uids == [1207658695]
        return {1207658695: 233}

    monkeypatch.setattr(GogClient, "get_owned_library", fake_get_owned_library)
    monkeypatch.setattr(IGDBClient, "get_igdb_ids_for_external", fake_get_igdb_ids)

    result = gog_jobs.run(lambda: db_session)

    assert result == {"total": 1, "succeeded": 1, "failed": 0, "failures": []}
    entry = gog_repository.get_entry(db_session, 1207658695)
    assert entry.game_id == game_id  # matched and cached, ready for the GOG Sync page
    assert entry.gog_name == "The Witcher 3"


def test_run_keeps_an_unmatched_game_cached(db_session, test_user, monkeypatch):
    _configure_gog(test_user, db_session)

    async def fake_get_owned_library(self):
        return [GogOwnedGame(product_id=1207658695, name="The Witcher 3")]

    async def fake_get_igdb_ids(self, source, uids):
        return {}

    monkeypatch.setattr(GogClient, "get_owned_library", fake_get_owned_library)
    monkeypatch.setattr(IGDBClient, "get_igdb_ids_for_external", fake_get_igdb_ids)

    result = gog_jobs.run(lambda: db_session)

    assert result["succeeded"] == 1
    entry = gog_repository.get_entry(db_session, 1207658695)
    assert entry.game_id is None  # no IGDB match — stays cached, unmatched


def test_run_isolates_a_per_game_failure(db_session, test_user, monkeypatch):
    _configure_gog(test_user, db_session)
    # The good game's IGDB id is seeded locally so its match resolves without a
    # real IGDB import call; only the failing id exercises the error path.
    _seed_game(db_session, igdb_id=245, name="Cyberpunk 2077")

    async def fake_get_owned_library(self):
        return [
            GogOwnedGame(product_id=1207658695, name="The Witcher 3"),
            GogOwnedGame(product_id=1207658885, name="Cyberpunk 2077"),
        ]

    async def fake_get_igdb_ids(self, source, uids):
        raise RuntimeError("IGDB is down")

    async def fake_get_igdb_id(self, source, uid):
        if uid == "1207658695":
            raise RuntimeError("IGDB is down")
        return 245

    monkeypatch.setattr(GogClient, "get_owned_library", fake_get_owned_library)
    monkeypatch.setattr(IGDBClient, "get_igdb_ids_for_external", fake_get_igdb_ids)
    monkeypatch.setattr(IGDBClient, "get_igdb_id_for_external", fake_get_igdb_id)

    result = gog_jobs.run(lambda: db_session)

    assert result["succeeded"] == 1
    assert result["failed"] == 1
    assert result["failures"][0]["gameId"] == 1207658695


def test_run_skips_matching_for_an_ignored_entry(db_session, test_user, monkeypatch):
    _seed_game(db_session, igdb_id=233, name="The Witcher 3")
    db_session.add(
        GogLibraryEntry(gog_product_id=1207658695, gog_name="The Witcher 3", game_id=None, dismissed=True)
    )
    db_session.commit()
    _configure_gog(test_user, db_session)

    async def fake_get_owned_library(self):
        return [GogOwnedGame(product_id=1207658695, name="The Witcher 3")]

    async def fake_get_igdb_ids(self, source, uids):
        raise AssertionError("ignored entries must not be matched")

    monkeypatch.setattr(GogClient, "get_owned_library", fake_get_owned_library)
    monkeypatch.setattr(IGDBClient, "get_igdb_ids_for_external", fake_get_igdb_ids)

    result = gog_jobs.run(lambda: db_session)

    assert result["succeeded"] == 1
    entry = gog_repository.get_entry(db_session, 1207658695)
    assert entry.game_id is None
    assert entry.dismissed is True


@respx.mock
def test_run_persists_a_rotated_refresh_token(db_session, test_user, monkeypatch):
    from app.models.system import User

    user_id = test_user.id  # captured before run() below closes db_session
    _seed_game(db_session, igdb_id=233, name="The Witcher 3")
    _configure_gog(test_user, db_session)
    respx.get(f"{GOG_AUTH_BASE}/token").mock(
        return_value=httpx.Response(
            200,
            json={
                "access_token": "access-2",
                "expires_in": 3600,
                "token_type": "Bearer",
                "refresh_token": "refresh-rotated",
                "user_id": "424242",
            },
        )
    )
    respx.get("https://embed.gog.com/account/getFilteredProducts").mock(
        return_value=httpx.Response(
            200, json={"totalPages": 1, "products": [{"id": 1207658695, "title": "The Witcher 3"}]}
        )
    )

    async def fake_get_igdb_ids(self, source, uids):
        return {1207658695: 233}

    monkeypatch.setattr(IGDBClient, "get_igdb_ids_for_external", fake_get_igdb_ids)

    result = gog_jobs.run(lambda: db_session)

    assert result["succeeded"] == 1
    db_session.expire_all()
    user = db_session.get(User, user_id)
    assert user is not None
    assert user.gog_refresh_token == "refresh-rotated"


@respx.mock
def test_download_drain_resets_stale_rows_and_isolates_a_failure(
    db_session, test_user, tmp_path, monkeypatch
):
    """A row left 'downloading' by a restart goes back to queued at the start of a
    run, and one file that fails (bad downlink) doesn't stop the next file."""
    from app.models.gog import GogDownload, GogDownloadStatus
    from app.services import gog_download_service

    monkeypatch.setattr(gog_download_service, "UPLOADS_DIR", tmp_path / "uploads")
    _configure_gog(test_user, db_session)
    game = _seed_game(db_session, igdb_id=233, name="The Witcher 3")
    game_id = game.id
    db_session.add(
        GogDownload(
            game_id=game_id,
            gog_product_id=1207658695,
            installer_id="installer_windows_en",
            file_id="en1installer0",
            total_size=20,
            downloaded_bytes=20,
            status=GogDownloadStatus.DOWNLOADING,  # interrupted by a restart
            filename=None,
        )
    )
    db_session.add(
        GogDownload(
            game_id=game_id,
            gog_product_id=1207658885,
            installer_id="installer_windows_en",
            file_id="en1installer0",
            total_size=20,
            status=GogDownloadStatus.QUEUED,
        )
    )
    db_session.commit()

    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json={
        "access_token": "access-1",
        "expires_in": 3600,
        "token_type": "Bearer",
        "refresh_token": "refresh-1",
        "user_id": "424242",
    }))
    respx.get("https://api.gog.com/products/1207658695").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": 1207658695,
                "title": "The Witcher 3",
                "downloads": {
                    "installers": [
                        {
                            "id": "installer_windows_en",
                            "os": "windows",
                            "language": "en",
                            "version": "1.32",
                            "total_size": 20,
                            "files": [
                                {
                                    "id": "en1installer0",
                                    "size": 20,
                                    "downlink": "https://api.gog.com/products/1207658695/downlink/installer/en1installer0",
                                }
                            ],
                        }
                    ]
                },
                "expanded_dlcs": [],
            },
        )
    )
    # The first file's downlink is gone — it fails, and the drain moves on.
    respx.get("https://api.gog.com/products/1207658695/downlink/installer/en1installer0").mock(
        return_value=httpx.Response(404, json={"error": "not found"})
    )
    respx.get("https://api.gog.com/products/1207658885").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": 1207658885,
                "title": "Cyberpunk 2077",
                "downloads": {
                    "installers": [
                        {
                            "id": "installer_windows_en",
                            "os": "windows",
                            "language": "en",
                            "version": "1.0",
                            "total_size": 20,
                            "files": [
                                {
                                    "id": "en1installer0",
                                    "size": 20,
                                    "downlink": "https://api.gog.com/products/1207658885/downlink/installer/en1installer0",
                                }
                            ],
                        }
                    ]
                },
                "expanded_dlcs": [],
            },
        )
    )
    respx.get("https://api.gog.com/products/1207658885/downlink/installer/en1installer0").mock(
        return_value=httpx.Response(200, json={"downlink": "https://cdn.gog.com/setup_cyberpunk.exe"})
    )
    respx.get("https://cdn.gog.com/setup_cyberpunk.exe").mock(
        return_value=httpx.Response(200, content=b"fake-installer-bytes")
    )

    result = gog_jobs.run_download(lambda: db_session)

    assert result["downloaded"] == 1
    assert result["failed"] == 1
    assert result["failures"][0]["fileId"] == "en1installer0"
    failed = gog_download_service.get_download(db_session, 1207658695, "en1installer0")
    assert failed.status == GogDownloadStatus.FAILED
    assert failed.error
    done = gog_download_service.get_download(db_session, 1207658885, "en1installer0")
    assert done.status == GogDownloadStatus.COMPLETED
    assert done.filename == "setup_cyberpunk.exe"
    assert (
        tmp_path / "uploads" / "gog-installers" / "1207658885" / "setup_cyberpunk.exe"
    ).read_bytes() == b"fake-installer-bytes"

def _mock_token():
    respx.get(f"{GOG_AUTH_BASE}/token").mock(
        return_value=httpx.Response(
            200,
            json={
                "access_token": "access-1",
                "expires_in": 3600,
                "token_type": "Bearer",
                "refresh_token": "refresh-1",
                "user_id": "424242",
            },
        )
    )


def _mock_cdn_product(product_id, title, cdn_url, cdn_response):
    """A product whose installer downlink resolves to the given CDN response."""
    respx.get(f"https://api.gog.com/products/{product_id}").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": product_id,
                "title": title,
                "downloads": {
                    "installers": [
                        {
                            "id": "installer_windows_en",
                            "os": "windows",
                            "language": "en",
                            "version": "1.0",
                            "total_size": 15,
                            "files": [
                                {
                                    "id": "en1installer0",
                                    "size": 15,
                                    "downlink": f"https://api.gog.com/products/{product_id}/downlink/installer/en1installer0",
                                }
                            ],
                        }
                    ]
                },
                "expanded_dlcs": [],
            },
        )
    )
    respx.get(f"https://api.gog.com/products/{product_id}/downlink/installer/en1installer0").mock(
        return_value=httpx.Response(200, json={"downlink": cdn_url})
    )
    respx.get(cdn_url).mock(return_value=cdn_response)


def _seed_download_row(db_session, game_id, product_id, total_size):
    from app.models.gog import GogDownload, GogDownloadStatus

    db_session.add(
        GogDownload(
            game_id=game_id,
            gog_product_id=product_id,
            installer_id="installer_windows_en",
            file_id="en1installer0",
            total_size=total_size,
            status=GogDownloadStatus.QUEUED,
        )
    )
    db_session.commit()


@respx.mock
def test_download_drain_accepts_file_bigger_than_rounded_api_size(
    db_session, test_user, tmp_path, monkeypatch
):
    """GOG's API file sizes are rounded to whole megabytes, so the queued total
    (15 bytes here, standing in for a whole-MB-rounded size) is smaller than the
    file the CDN actually serves (20 bytes). The download must still complete —
    trusting the CDN's Content-Length — and correct the row's total to the bytes
    actually written, so the on-disk check and the UI agree afterwards. The same
    run also covers a chunked response with no Content-Length at all."""
    from app.models.gog import GogDownloadStatus
    from app.services import gog_download_service

    monkeypatch.setattr(gog_download_service, "UPLOADS_DIR", tmp_path / "uploads")
    _configure_gog(test_user, db_session)
    game = _seed_game(db_session, igdb_id=233, name="The Witcher 3")
    game_id = game.id
    _seed_download_row(db_session, game_id, 1207658695, total_size=15)
    _seed_download_row(db_session, game_id, 1207658885, total_size=15)
    _mock_token()
    _mock_cdn_product(
        1207658695,
        "The Witcher 3",
        "https://cdn.gog.com/setup_witcher.exe",
        httpx.Response(200, content=b"fake-installer-bytes"),
    )
    chunked = httpx.Response(200, content=b"fake-installer-bytes")
    del chunked.headers["content-length"]
    _mock_cdn_product(
        1207658885,
        "Cyberpunk 2077",
        "https://cdn.gog.com/setup_cyberpunk.exe",
        chunked,
    )

    result = gog_jobs.run_download(lambda: db_session)

    assert result == {"downloaded": 2, "failed": 0, "failures": []}
    for product_id in (1207658695, 1207658885):
        done = gog_download_service.get_download(db_session, product_id, "en1installer0")
        assert done.status == GogDownloadStatus.COMPLETED
        assert done.total_size == 20  # corrected from the rounded 15
        assert done.downloaded_bytes == 20
        assert (
            tmp_path / "uploads" / "gog-installers" / str(product_id) / done.filename
        ).read_bytes() == b"fake-installer-bytes"


@respx.mock
def test_download_drain_accepts_gzipped_cdn_response(
    db_session, test_user, tmp_path, monkeypatch
):
    """When the CDN gzips the body, the decoded byte count overshoots the
    Content-Length, so the length must not be treated as authoritative — the
    completed stream is the file, and its true size is recorded."""
    from app.models.gog import GogDownloadStatus
    from app.services import gog_download_service

    monkeypatch.setattr(gog_download_service, "UPLOADS_DIR", tmp_path / "uploads")
    _configure_gog(test_user, db_session)
    game = _seed_game(db_session, igdb_id=233, name="The Witcher 3")
    _seed_download_row(db_session, game.id, 1207658695, total_size=15)
    _mock_token()
    compressed = gzip.compress(b"fake-installer-bytes")
    _mock_cdn_product(
        1207658695,
        "The Witcher 3",
        "https://cdn.gog.com/setup_witcher.exe",
        httpx.Response(200, content=compressed, headers={"Content-Encoding": "gzip"}),
    )

    result = gog_jobs.run_download(lambda: db_session)

    assert result == {"downloaded": 1, "failed": 0, "failures": []}
    done = gog_download_service.get_download(db_session, 1207658695, "en1installer0")
    assert done.status == GogDownloadStatus.COMPLETED
    assert done.total_size == 20
    assert (
        tmp_path / "uploads" / "gog-installers" / "1207658695" / done.filename
    ).read_bytes() == b"fake-installer-bytes"


@respx.mock
def test_download_drain_still_fails_a_truncated_file(
    db_session, test_user, tmp_path, monkeypatch
):
    """The size check still protects against a genuinely short file: a
    Content-Length of 100 with only 20 bytes delivered fails the row instead of
    being kept as a complete download."""
    from app.models.gog import GogDownloadStatus
    from app.services import gog_download_service

    monkeypatch.setattr(gog_download_service, "UPLOADS_DIR", tmp_path / "uploads")
    _configure_gog(test_user, db_session)
    game = _seed_game(db_session, igdb_id=233, name="The Witcher 3")
    _seed_download_row(db_session, game.id, 1207658695, total_size=15)
    _mock_token()
    _mock_cdn_product(
        1207658695,
        "The Witcher 3",
        "https://cdn.gog.com/setup_witcher.exe",
        httpx.Response(200, content=b"fake-installer-bytes", headers={"Content-Length": "100"}),
    )

    result = gog_jobs.run_download(lambda: db_session)

    assert result["downloaded"] == 0
    assert result["failed"] == 1
    failed = gog_download_service.get_download(db_session, 1207658695, "en1installer0")
    assert failed.status == GogDownloadStatus.FAILED
    assert failed.error
