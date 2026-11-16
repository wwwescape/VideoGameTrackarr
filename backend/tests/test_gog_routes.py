import time

import httpx
import pytest
import respx
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.main import UploadsStaticFiles
from app.models.catalog import Game, GameCategory, Platform
from app.models.gog import GogLibraryEntry
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.services import gog_download_service
from app.services.gog_client import GOG_API_BASE, GOG_AUTH_BASE, GOG_EMBED_BASE, GOG_USERS_BASE

PRODUCT_ID = 1207658695
TOKEN_PAYLOAD = {
    "access_token": "access-1",
    "expires_in": 3600,
    "token_type": "Bearer",
    "refresh_token": "refresh-1",
    "user_id": "424242",
    "session_id": "session-1",
}
PRODUCT_PAYLOAD = {
    "id": PRODUCT_ID,
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
                        "downlink": f"{GOG_API_BASE}/products/{PRODUCT_ID}/downlink/installer/en1installer0",
                    }
                ],
            }
        ],
        "patches": [],
        "language_packs": [],
    },
    "expanded_dlcs": [],
}
INSTALLER_BYTES = b"fake-installer-bytes"


def _seed_matched_entry(db_session, gog_product_id=PRODUCT_ID, dismissed=False):
    game = Game(igdb_id=233, name="The Witcher 3", slug="the-witcher-3", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    entry = GogLibraryEntry(
        gog_product_id=gog_product_id,
        gog_name="The Witcher 3",
        game_id=game.id,
        dismissed=dismissed,
    )
    db_session.add(entry)
    db_session.commit()
    return game


def _seed_gog_platform(db_session, name="GOG Galaxy"):
    platform = Platform(name=name, slug="gog-galaxy")
    db_session.add(platform)
    db_session.commit()
    return platform


def _seed_gog_library_item(db_session, game, platform):
    db_session.add(
        LibraryItem(
            game_id=game.id,
            platform_id=platform.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.DIGITAL,
            digital_storefront="GOG",
        )
    )
    db_session.commit()


def _configure_gog(test_user, db_session):
    test_user.gog_refresh_token = "test-refresh-token"
    db_session.commit()


def test_get_gog_entries_requires_auth(client):
    response = client.get("/api/integrations/gog/entries")

    assert response.status_code == 401


def test_get_gog_entries_reports_new_for_a_matched_untracked_game(auth_client, db_session):
    _seed_matched_entry(db_session)

    [entry] = auth_client.get("/api/integrations/gog/entries").json()

    assert entry["status"] == "new"
    assert entry["gogProductId"] == PRODUCT_ID
    assert entry["gameName"] == "The Witcher 3"


def test_get_gog_entries_reports_up_to_date_for_a_synced_game(auth_client, db_session):
    game = _seed_matched_entry(db_session)
    platform = _seed_gog_platform(db_session)
    _seed_gog_library_item(db_session, game, platform)

    [entry] = auth_client.get("/api/integrations/gog/entries").json()

    assert entry["status"] == "up_to_date"


def test_get_gog_entries_reports_no_match_for_an_unmatched_entry(auth_client, db_session):
    game = Game(igdb_id=233, name="The Witcher 3", slug="the-witcher-3", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    db_session.add(GogLibraryEntry(gog_product_id=PRODUCT_ID, gog_name="The Witcher 3", game_id=None))
    db_session.commit()

    [entry] = auth_client.get("/api/integrations/gog/entries").json()

    assert entry["status"] == "no_match"
    assert entry["gameId"] is None


def test_get_gog_entries_reports_ignored_entries_but_still_lists_them(auth_client, db_session):
    _seed_matched_entry(db_session, dismissed=True)

    [entry] = auth_client.get("/api/integrations/gog/entries").json()

    assert entry["status"] == "ignored"


def test_sync_gog_entries_creates_library_item_on_the_gog_galaxy_platform(auth_client, db_session):
    game = _seed_matched_entry(db_session)

    response = auth_client.post("/api/integrations/gog/sync", json={"gogProductIds": [PRODUCT_ID]})

    assert response.status_code == 200
    assert response.json() == {"synced": 1, "failed": 0, "failures": []}
    platforms = db_session.query(Platform).filter_by(slug="gog-galaxy").all()
    assert len(platforms) == 1
    assert platforms[0].name == "GOG Galaxy"
    item = (
        db_session.query(LibraryItem)
        .filter_by(game_id=game.id, platform_id=platforms[0].id)
        .one()
    )
    assert item.status == LibraryStatus.OWNED
    assert item.format == MediaFormat.DIGITAL
    assert item.digital_storefront == "GOG"


def test_sync_gog_entries_reuses_an_existing_gog_galaxy_platform(auth_client, db_session):
    _seed_matched_entry(db_session)
    platform = _seed_gog_platform(db_session, name="GOG")

    response = auth_client.post("/api/integrations/gog/sync", json={"gogProductIds": [PRODUCT_ID]})

    assert response.status_code == 200
    assert db_session.query(Platform).filter_by(slug="gog-galaxy").count() == 1
    assert db_session.query(LibraryItem).filter_by(platform_id=platform.id).count() == 1


def test_relink_gog_entry_onto_a_game_linked_elsewhere_conflicts(auth_client, db_session):
    game_a = _seed_matched_entry(db_session, gog_product_id=PRODUCT_ID)
    game_b = Game(igdb_id=245, name="Cyberpunk 2077", slug="cyberpunk-2077", category=GameCategory.MAIN_GAME)
    db_session.add(game_b)
    db_session.commit()
    db_session.add(GogLibraryEntry(gog_product_id=1207658885, gog_name="Cyberpunk 2077", game_id=game_b.id))
    db_session.commit()

    response = auth_client.post(f"/api/integrations/gog/{PRODUCT_ID}/relink", json={"gameId": game_b.id})

    assert response.status_code == 409
    assert game_a.id != game_b.id


def test_ignore_and_unignore_gog_entry(auth_client, db_session):
    _seed_matched_entry(db_session)

    ignored = auth_client.post(f"/api/integrations/gog/{PRODUCT_ID}/ignore").json()
    assert ignored["status"] == "ignored"

    restored = auth_client.post(f"/api/integrations/gog/{PRODUCT_ID}/unignore").json()
    assert restored["status"] == "new"


@respx.mock
def test_connect_gog_saves_token_and_username(auth_client, db_session, test_user):
    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json=TOKEN_PAYLOAD))
    respx.get(f"{GOG_USERS_BASE}/users/424242").mock(
        return_value=httpx.Response(200, json={"username": "Flyingfox"})
    )

    response = auth_client.post(
        "/api/integrations/gog/connect",
        json={"redirectUrl": "https://embed.gog.com/on_login_success?origin=client&code=auth-code-123"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "configured": True,
        "username": "Flyingfox",
        "authorizeUrl": "https://auth.gog.com/auth?client_id=46899977096215655&redirect_uri=https://embed.gog.com/on_login_success?origin=client&response_type=code&layout=client2",
    }
    db_session.expire_all()
    assert test_user.gog_refresh_token == "refresh-1"
    assert test_user.gog_user_id == "424242"
    assert test_user.gog_username == "Flyingfox"


@respx.mock
def test_connect_gog_rejects_a_bad_code(auth_client):
    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(400, json={"error": "invalid_grant"}))

    response = auth_client.post(
        "/api/integrations/gog/connect",
        json={"redirectUrl": "https://embed.gog.com/on_login_success?origin=client&code=bad-code"},
    )

    assert response.status_code == 422


def test_disconnect_gog_clears_the_saved_login(auth_client, db_session, test_user):
    _configure_gog(test_user, db_session)
    test_user.gog_username = "Flyingfox"
    db_session.commit()

    response = auth_client.post("/api/integrations/gog/disconnect")

    assert response.status_code == 200
    assert response.json()["configured"] is False
    assert response.json()["username"] is None
    db_session.expire_all()
    assert test_user.gog_refresh_token is None


def test_get_installers_requires_a_gog_imported_game(auth_client, db_session):
    # No GOG entry at all.
    response = auth_client.get("/api/integrations/gog/games/1/installers")

    assert response.status_code == 404


def test_get_installers_requires_the_game_to_be_synced(auth_client, db_session):
    _seed_matched_entry(db_session)

    response = auth_client.get("/api/integrations/gog/games/1/installers")

    assert response.status_code == 404


@respx.mock
def test_get_installers_lists_groups_with_download_states(auth_client, db_session, test_user):
    game = _seed_matched_entry(db_session)
    platform = _seed_gog_platform(db_session)
    _seed_gog_library_item(db_session, game, platform)
    _configure_gog(test_user, db_session)
    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json=TOKEN_PAYLOAD))
    respx.get(f"{GOG_EMBED_BASE}/account/getFilteredProducts").mock(
        return_value=httpx.Response(200, json={"totalPages": 1, "products": []})
    )
    respx.get(f"{GOG_API_BASE}/products/{PRODUCT_ID}").mock(
        return_value=httpx.Response(200, json=PRODUCT_PAYLOAD)
    )

    response = auth_client.get(f"/api/integrations/gog/games/{game.id}/installers")

    assert response.status_code == 200
    body = response.json()
    assert body["gogProductId"] == PRODUCT_ID
    [group] = body["groups"]
    assert group["title"] == "The Witcher 3"
    [installer] = group["installers"]
    assert installer["os"] == "windows"
    [file] = installer["files"]
    assert file["id"] == "en1installer0"
    assert file["size"] == 20
    assert file["downloadState"] == "not_downloaded"
    assert file["downloadedBytes"] == 0
    assert file["downloadError"] is None


@respx.mock
def test_nas_download_flow_serves_the_file_to_the_device(
    client, auth_client, db_session, test_user, tmp_path, monkeypatch
):
    """Queue → drainer downloads to the NAS → installers read shows completed →
    tokenized link downloads the file to the device. The drainer writes into an
    isolated folder, never the real backend/uploads."""
    monkeypatch.setattr(gog_download_service, "UPLOADS_DIR", tmp_path / "uploads")
    game = _seed_matched_entry(db_session)
    platform = _seed_gog_platform(db_session)
    _seed_gog_library_item(db_session, game, platform)
    _configure_gog(test_user, db_session)
    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json=TOKEN_PAYLOAD))
    respx.get(f"{GOG_API_BASE}/products/{PRODUCT_ID}").mock(
        return_value=httpx.Response(200, json=PRODUCT_PAYLOAD)
    )
    respx.get(f"{GOG_API_BASE}/products/{PRODUCT_ID}/downlink/installer/en1installer0").mock(
        return_value=httpx.Response(200, json={"downlink": "https://cdn.gog.com/setup_witcher3.exe"})
    )
    respx.get("https://cdn.gog.com/setup_witcher3.exe").mock(
        return_value=httpx.Response(200, content=INSTALLER_BYTES)
    )

    # The file link is a 404 until the download has finished.
    assert (
        auth_client.post(
            f"/api/integrations/gog/games/{game.id}/installers/en1installer0/file-link"
        ).status_code
        == 404
    )

    queued = auth_client.post(
        f"/api/integrations/gog/games/{game.id}/installers/queue",
        json={"installerId": "installer_windows_en", "fileId": "en1installer0"},
    )
    assert queued.status_code == 200
    assert queued.json()["status"] == "queued"
    assert queued.json()["totalSize"] == 20

    # The queue endpoint triggers the drainer job on a background thread (the same
    # shape as the restore job) — poll the installers read until it finishes.
    deadline = time.monotonic() + 20
    file_state = None
    while time.monotonic() < deadline:
        [file_state] = auth_client.get(f"/api/integrations/gog/games/{game.id}/installers").json()["groups"][0][
            "installers"
        ][0]["files"]
        if file_state["downloadState"] in ("completed", "failed"):
            break
        time.sleep(0.2)
    assert file_state is not None
    assert file_state["downloadState"] == "completed", file_state.get("downloadError")
    assert file_state["downloadedBytes"] == 20

    link = auth_client.post(
        f"/api/integrations/gog/games/{game.id}/installers/en1installer0/file-link"
    )
    assert link.status_code == 200
    url = link.json()["url"]
    assert url.startswith(
        f"/api/integrations/gog/games/{game.id}/installers/en1installer0/file/"
    )

    # A plain browser navigation (no Authorization header) streams the file.
    client.headers.pop("Authorization", None)
    downloaded = client.get(url)
    assert downloaded.status_code == 200
    assert downloaded.content == INSTALLER_BYTES
    assert "setup_witcher3.exe" in downloaded.headers["content-disposition"]

    # The on-disk file is exactly where the NAS route puts it.
    on_disk = tmp_path / "uploads" / "gog-installers" / str(PRODUCT_ID) / "setup_witcher3.exe"
    assert on_disk.read_bytes() == INSTALLER_BYTES


def test_uploads_mount_blocks_gog_installers(tmp_path):
    """The public /uploads mount must never serve an installer — the tokenized file
    route is the only way one leaves the NAS. Covers are still served."""
    static = UploadsStaticFiles(directory=str(tmp_path))

    with pytest.raises(StarletteHTTPException) as excinfo:
        static.get_path({"type": "http", "path": "/gog-installers/1207658695/setup_game.exe"})
    assert excinfo.value.status_code == 404

    with pytest.raises(StarletteHTTPException):
        static.get_path({"type": "http", "path": "/roms/game.nes"})
    assert static.get_path({"type": "http", "path": "/covers/game.jpg"}) == "covers/game.jpg"

