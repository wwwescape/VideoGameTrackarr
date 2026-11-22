import httpx
import pytest
import respx

from app.core.security import create_gog_installer_token
from app.models.catalog import Game, GameCategory
from app.models.gog import GogDownload, GogDownloadStatus, GogLibraryEntry
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.services import gog_download_service, gog_jobs, gog_service
from app.services.gog_client import (
    GOG_API_BASE,
    GogAuthError,
    GogClient,
    GogInstaller,
    GogInstallerFile,
    GogInstallerGroup,
)

BASE_ID = 1207664663
DLC_ID = 1640424747
CDN = "https://gog-cdn-fastly.gog.com/token/setup_witcher_3_(64bit).exe"


def _installers() -> list[GogInstallerGroup]:
    return [
        GogInstallerGroup(
            product_id=BASE_ID,
            title="The Witcher 3",
            installers=[
                GogInstaller(
                    id="en1installer0",
                    os="windows",
                    language="en",
                    version="4.04",
                    total_size=3,
                    files=[
                        GogInstallerFile(id="en1installer0", size=2, downlink=f"{GOG_API_BASE}/downlink/a"),
                        GogInstallerFile(id="en1installer1", size=1, downlink=f"{GOG_API_BASE}/downlink/b"),
                    ],
                )
            ],
        ),
        GogInstallerGroup(
            product_id=DLC_ID,
            title="Blood and Wine",
            installers=[
                GogInstaller(
                    id="en1installer0",
                    os="windows",
                    language="en",
                    version="1.0",
                    total_size=1,
                    files=[GogInstallerFile(id="en1installer0", size=1, downlink=f"{GOG_API_BASE}/downlink/c")],
                )
            ],
        ),
    ]


@pytest.fixture(autouse=True)
def _isolated(tmp_path, monkeypatch, db_session, test_user):
    """Downloads land in tmp_path, GOG is "connected", the installer listing is faked, the
    cache starts empty, and routes never start the real background download job."""
    monkeypatch.setattr(gog_download_service, "get_downloads_dir", lambda: tmp_path / "gog-installers")
    monkeypatch.setattr(gog_jobs, "_DRAIN_GRACE_SECONDS", 0)
    monkeypatch.setattr(gog_jobs, "ensure_download_job_running", lambda session_factory: None)
    gog_service.clear_installers_cache()
    test_user.gog_refresh_token = "refresh-1"
    db_session.commit()
    calls: list[int] = []

    async def fake_downloads(self, product_id):
        calls.append(product_id)
        return [group for group in _installers() if product_id == BASE_ID or group.product_id == product_id]

    monkeypatch.setattr(GogClient, "get_product_downloads", fake_downloads)
    yield calls
    gog_service.clear_installers_cache()


def _gog_game(db_session, seed_pc_platform, with_copy=True) -> Game:
    game = Game(igdb_id=1942, name="The Witcher 3", slug="the-witcher-3", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    db_session.add(GogLibraryEntry(gog_product_id=BASE_ID, gog_name="The Witcher 3", game_id=game.id))
    if with_copy:
        db_session.add(
            LibraryItem(
                game_id=game.id,
                platform_id=seed_pc_platform.id,
                status=LibraryStatus.OWNED,
                format=MediaFormat.DIGITAL,
                digital_storefront="GOG",
            )
        )
    db_session.commit()
    return game


def _completed(db_session, game, tmp_path, file_id="en1installer0", content=b"ab", product_id=BASE_ID) -> GogDownload:
    row = GogDownload(
        game_id=game.id,
        gog_product_id=product_id,
        installer_id="en1installer0",
        file_id=file_id,
        filename=f"{file_id}.exe",
        total_size=len(content),
        downloaded_bytes=len(content),
        status=GogDownloadStatus.COMPLETED,
    )
    db_session.add(row)
    db_session.commit()
    path = gog_download_service.file_path(row)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return row


# --- client -----------------------------------------------------------------------------


async def test_resolve_downlink_refuses_links_outside_gogs_api():
    async with GogClient(access_token="a", access_token_expires_at=9_999_999_999) as client:
        with pytest.raises(GogAuthError):
            await client.resolve_downlink("https://evil.example/steal")


# --- installers listing and queueing ------------------------------------------------------


def test_installers_need_a_synced_gog_copy(auth_client, db_session, seed_pc_platform):
    game = _gog_game(db_session, seed_pc_platform, with_copy=False)

    assert auth_client.get(f"/api/integrations/gog/games/{game.id}/installers").status_code == 404


def test_installers_list_base_game_and_dlc_and_are_cached(auth_client, db_session, seed_pc_platform, _isolated):
    game = _gog_game(db_session, seed_pc_platform)

    first = auth_client.get(f"/api/integrations/gog/games/{game.id}/installers").json()
    auth_client.get(f"/api/integrations/gog/games/{game.id}/installers")

    assert [group["productId"] for group in first["groups"]] == [BASE_ID, DLC_ID]
    part = first["groups"][0]["installers"][0]["files"][0]
    assert part == {
        "id": "en1installer0",
        "size": 2,
        "downloadId": None,
        "state": "not_downloaded",
        "downloadedBytes": 0,
        "error": None,
        "filename": None,
    }
    assert _isolated == [BASE_ID]


def test_queueing_an_installer_queues_every_part(auth_client, db_session, seed_pc_platform):
    game = _gog_game(db_session, seed_pc_platform)

    body = auth_client.post(
        f"/api/integrations/gog/games/{game.id}/installers/download",
        json={"productId": BASE_ID, "installerId": "en1installer0"},
    ).json()

    states = [part["state"] for part in body["groups"][0]["installers"][0]["files"]]
    assert states == ["queued", "queued"]
    assert db_session.query(GogDownload).count() == 2
    # The DLC's installer shares the base game's file id but is a different product.
    dlc_states = [part["state"] for part in body["groups"][1]["installers"][0]["files"]]
    assert dlc_states == ["not_downloaded"]


def test_queueing_again_keeps_finished_parts_and_retries_failed_ones(
    auth_client, db_session, seed_pc_platform, tmp_path
):
    game = _gog_game(db_session, seed_pc_platform)
    done = _completed(db_session, game, tmp_path)
    failed = GogDownload(
        game_id=game.id,
        gog_product_id=BASE_ID,
        installer_id="en1installer0",
        file_id="en1installer1",
        status=GogDownloadStatus.FAILED,
        error="boom",
    )
    db_session.add(failed)
    db_session.commit()

    auth_client.post(
        f"/api/integrations/gog/games/{game.id}/installers/download",
        json={"productId": BASE_ID, "installerId": "en1installer0"},
    )

    db_session.expire_all()
    assert db_session.get(GogDownload, done.id).status == GogDownloadStatus.COMPLETED
    assert db_session.get(GogDownload, failed.id).status == GogDownloadStatus.QUEUED
    assert db_session.get(GogDownload, failed.id).error is None


def test_queueing_an_unknown_installer_is_a_404(auth_client, db_session, seed_pc_platform):
    game = _gog_game(db_session, seed_pc_platform)

    response = auth_client.post(
        f"/api/integrations/gog/games/{game.id}/installers/download",
        json={"productId": BASE_ID, "installerId": "nope"},
    )

    assert response.status_code == 404


# --- the download job --------------------------------------------------------------------


def _queue(db_session, game, file_id="en1installer0", size=2) -> GogDownload:
    row = GogDownload(
        game_id=game.id,
        gog_product_id=BASE_ID,
        installer_id="en1installer0",
        file_id=file_id,
        total_size=size,
        status=GogDownloadStatus.QUEUED,
    )
    db_session.add(row)
    db_session.commit()
    return row


@respx.mock
def test_the_job_downloads_queued_files_into_place(db_session, seed_pc_platform, monkeypatch):
    game = _gog_game(db_session, seed_pc_platform)
    row_id = _queue(db_session, game).id

    async def fake_resolve(self, downlink):
        return CDN

    monkeypatch.setattr(GogClient, "resolve_downlink", fake_resolve)
    respx.get(CDN).mock(return_value=httpx.Response(200, content=b"abc", headers={"content-length": "3"}))

    result = gog_jobs.run_download(lambda: db_session)

    assert result["downloaded"] == 1
    row = db_session.get(GogDownload, row_id)
    assert row.status == GogDownloadStatus.COMPLETED
    assert row.filename == "setup_witcher_3_(64bit).exe"
    # GOG's listed size (2) was only an estimate; the real size wins.
    assert row.total_size == 3
    assert gog_download_service.file_path(row).read_bytes() == b"abc"
    assert not gog_download_service.part_path(row).exists()


@respx.mock
def test_a_failed_download_is_marked_failed_without_leaving_a_partial_file(db_session, seed_pc_platform, monkeypatch):
    game = _gog_game(db_session, seed_pc_platform)
    row_id = _queue(db_session, game).id

    async def fake_resolve(self, downlink):
        return CDN

    monkeypatch.setattr(GogClient, "resolve_downlink", fake_resolve)
    respx.get(CDN).mock(return_value=httpx.Response(500))

    result = gog_jobs.run_download(lambda: db_session)

    assert result["failed"] == 1
    row = db_session.get(GogDownload, row_id)
    assert row.status == GogDownloadStatus.FAILED
    assert row.error
    folder = gog_download_service.get_downloads_dir() / str(BASE_ID)
    assert not folder.exists() or not any(folder.iterdir())


def test_the_job_puts_interrupted_downloads_back_in_the_queue(db_session, seed_pc_platform):
    game = _gog_game(db_session, seed_pc_platform)
    row = _queue(db_session, game)
    row.status = GogDownloadStatus.DOWNLOADING
    row.downloaded_bytes = 5
    db_session.commit()

    assert gog_download_service.reset_stale(db_session) == 1
    assert row.status == GogDownloadStatus.QUEUED
    assert row.downloaded_bytes == 0


def test_saving_progress_for_a_cancelled_row_stops_the_download(db_session, seed_pc_platform):
    game = _gog_game(db_session, seed_pc_platform)
    row = _queue(db_session, game)
    gog_download_service.delete(db_session, row.id)

    with pytest.raises(gog_jobs.DownloadCancelled):
        gog_jobs._save_progress(db_session, row, 1)


# --- downloads list, retry, delete, save to device ------------------------------------------


def test_downloads_list_and_disk_use(auth_client, db_session, seed_pc_platform, tmp_path):
    game = _gog_game(db_session, seed_pc_platform)
    _completed(db_session, game, tmp_path, content=b"abcd")
    _queue(db_session, game, file_id="en1installer1")

    body = auth_client.get("/api/integrations/gog/downloads").json()

    assert body["bytesOnDisk"] == 4
    assert [row["status"] for row in body["downloads"]] == ["completed", "queued"]
    assert body["downloads"][0]["gameName"] == "The Witcher 3"


def test_retry_requeues_a_failed_download(auth_client, db_session, seed_pc_platform):
    game = _gog_game(db_session, seed_pc_platform)
    row = _queue(db_session, game)
    row.status = GogDownloadStatus.FAILED
    db_session.commit()

    assert auth_client.post(f"/api/integrations/gog/downloads/{row.id}/retry").json()["status"] == "queued"


def test_delete_removes_the_row_and_its_file(auth_client, db_session, seed_pc_platform, tmp_path):
    game = _gog_game(db_session, seed_pc_platform)
    row = _completed(db_session, game, tmp_path)
    path = gog_download_service.file_path(row)

    assert auth_client.delete(f"/api/integrations/gog/downloads/{row.id}").status_code == 204

    assert not path.exists()
    assert db_session.query(GogDownload).count() == 0


def test_a_signed_link_saves_the_file_to_the_device(auth_client, db_session, seed_pc_platform, tmp_path):
    game = _gog_game(db_session, seed_pc_platform)
    row = _completed(db_session, game, tmp_path, content=b"installer-bytes")

    url = auth_client.post(f"/api/integrations/gog/downloads/{row.id}/file-link").json()["url"]
    response = auth_client.get(url, headers={"Authorization": ""})

    assert response.status_code == 200
    assert response.content == b"installer-bytes"


def test_a_link_for_another_download_or_a_bad_token_is_refused(
    auth_client, db_session, seed_pc_platform, tmp_path, test_user
):
    game = _gog_game(db_session, seed_pc_platform)
    first = _completed(db_session, game, tmp_path, file_id="en1installer0")
    second = _completed(db_session, game, tmp_path, file_id="en1installer1")
    other_token = create_gog_installer_token(test_user.id, second.id)

    assert auth_client.get(f"/api/integrations/gog/downloads/{first.id}/file/{other_token}/x.exe").status_code == 401
    assert auth_client.get(f"/api/integrations/gog/downloads/{first.id}/file/garbage/x.exe").status_code == 401


def test_no_link_for_a_file_that_isnt_on_the_server(auth_client, db_session, seed_pc_platform):
    game = _gog_game(db_session, seed_pc_platform)
    row = _queue(db_session, game)

    assert auth_client.post(f"/api/integrations/gog/downloads/{row.id}/file-link").status_code == 404


def test_installers_are_never_served_from_the_public_uploads_mount(client):
    assert client.get("/uploads/gog-installers/1207664663/setup.exe").status_code == 404


# --- cleanup ------------------------------------------------------------------------------


def test_deleting_the_game_removes_its_installer_files(auth_client, db_session, seed_pc_platform, tmp_path):
    game = _gog_game(db_session, seed_pc_platform)
    path = gog_download_service.file_path(_completed(db_session, game, tmp_path))

    auth_client.delete(f"/api/games/{game.id}")

    assert not path.exists()


def test_removing_the_last_gog_copy_removes_its_installers(auth_client, db_session, seed_pc_platform, tmp_path):
    game = _gog_game(db_session, seed_pc_platform)
    path = gog_download_service.file_path(_completed(db_session, game, tmp_path))
    item = db_session.query(LibraryItem).filter(LibraryItem.game_id == game.id).one()

    auth_client.delete(f"/api/library/{item.id}")

    assert not path.exists()
    assert db_session.query(GogDownload).count() == 0


def test_prune_keeps_files_with_rows_and_running_partial_files(db_session, seed_pc_platform, tmp_path):
    game = _gog_game(db_session, seed_pc_platform)
    kept = gog_download_service.file_path(_completed(db_session, game, tmp_path))
    running = _queue(db_session, game, file_id="en1installer1")
    running.filename = "part2.bin"
    running.status = GogDownloadStatus.DOWNLOADING
    db_session.commit()
    partial = gog_download_service.part_path(running)
    partial.write_bytes(b"x")
    stray = kept.parent / "left-behind.bin"
    stray.write_bytes(b"x")

    assert gog_download_service.prune_orphan_files(db_session) == 1

    assert kept.exists()
    assert partial.exists()
    assert not stray.exists()
