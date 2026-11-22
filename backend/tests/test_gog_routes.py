import httpx
import pytest
import respx

from app.models.catalog import Game, GameCategory
from app.models.gog import GogDownload, GogLibraryEntry, GogWishlistEntry
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.models.system import User
from app.services import gog_service
from app.services.gog_client import GOG_API_BASE, GOG_AUTH_BASE, GOG_USERS_BASE, GogAuthError

_TOKENS = {"access_token": "access-1", "refresh_token": "refresh-1", "user_id": "4242", "expires_in": 3600}
_LANDING = "https://embed.gog.com/on_login_success?origin=client&code=abc123"


def _game(db_session, name="The Witcher 3", igdb_id=1942, parent_game_id=None, category=GameCategory.MAIN_GAME):
    game = Game(
        igdb_id=igdb_id,
        name=name,
        slug=name.lower().replace(" ", "-"),
        category=category,
        parent_game_id=parent_game_id,
    )
    db_session.add(game)
    db_session.commit()
    return game


def _entry(db_session, gog_product_id=1207664663, game=None, dismissed=False, name="The Witcher 3"):
    entry = GogLibraryEntry(
        gog_product_id=gog_product_id, gog_name=name, game_id=game.id if game else None, dismissed=dismissed
    )
    db_session.add(entry)
    db_session.commit()
    return entry


# --- account -----------------------------------------------------------------------------


def test_gog_routes_require_auth(client):
    assert client.get("/api/integrations/gog").status_code == 401
    assert client.get("/api/integrations/gog/entries").status_code == 401


def test_status_starts_disconnected_with_a_login_url(auth_client):
    body = auth_client.get("/api/integrations/gog").json()

    assert body["connected"] is False
    assert body["username"] is None
    assert body["loginUrl"].startswith(f"{GOG_AUTH_BASE}/auth?")
    integrations = auth_client.get("/api/integrations").json()
    assert integrations["gogConnected"] is False
    assert integrations["gogUsername"] is None


@respx.mock
def test_connect_with_the_landing_page_address_saves_the_account(auth_client, db_session):
    token_route = respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json=_TOKENS))
    respx.get(f"{GOG_USERS_BASE}/users/4242").mock(return_value=httpx.Response(200, json={"username": "geralt"}))

    response = auth_client.post("/api/integrations/gog/connect", json={"redirectUrl": _LANDING})

    assert response.status_code == 200
    assert response.json()["connected"] is True
    assert response.json()["username"] == "geralt"
    assert token_route.calls.last.request.url.params["code"] == "abc123"
    user = db_session.query(User).first()
    db_session.refresh(user)
    assert user.gog_refresh_token == "refresh-1"
    assert user.gog_user_id == "4242"
    assert auth_client.get("/api/integrations").json()["gogUsername"] == "geralt"


@respx.mock
def test_connect_still_succeeds_when_the_username_lookup_fails(auth_client):
    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(200, json=_TOKENS))
    respx.get(f"{GOG_USERS_BASE}/users/4242").mock(return_value=httpx.Response(500))

    response = auth_client.post("/api/integrations/gog/connect", json={"redirectUrl": _LANDING})

    assert response.status_code == 200
    assert response.json()["connected"] is True
    assert response.json()["username"] is None


@respx.mock
def test_connect_with_a_rejected_code_is_a_422(auth_client):
    respx.get(f"{GOG_AUTH_BASE}/token").mock(return_value=httpx.Response(400))

    response = auth_client.post("/api/integrations/gog/connect", json={"redirectUrl": _LANDING})

    assert response.status_code == 422
    assert auth_client.get("/api/integrations/gog").json()["connected"] is False


def test_connect_with_an_address_that_has_no_code_is_a_422(auth_client):
    response = auth_client.post(
        "/api/integrations/gog/connect", json={"redirectUrl": "https://embed.gog.com/on_login_success?origin=client"}
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("pasted", "code"),
    [(_LANDING, "abc123"), ("  abc123  ", "abc123"), ("https://x.test/?a=1&code=zz", "zz")],
)
def test_extract_code(pasted, code):
    assert gog_service.extract_code(pasted) == code


@pytest.mark.parametrize("pasted", ["", "   ", "https://embed.gog.com/on_login_success?origin=client"])
def test_extract_code_rejects_pastes_without_a_code(pasted):
    with pytest.raises(GogAuthError):
        gog_service.extract_code(pasted)


def test_disconnect_forgets_the_account_but_keeps_entries(auth_client, db_session, test_user):
    test_user.gog_refresh_token = "refresh-1"
    test_user.gog_username = "geralt"
    db_session.commit()
    _entry(db_session, dismissed=True)

    response = auth_client.post("/api/integrations/gog/disconnect")

    assert response.json()["connected"] is False
    db_session.refresh(test_user)
    assert test_user.gog_refresh_token is None
    assert test_user.gog_username is None
    assert db_session.query(GogLibraryEntry).count() == 1


def test_the_refresh_token_is_never_returned(auth_client, db_session, test_user):
    test_user.gog_refresh_token = "super-secret"
    db_session.commit()

    for path in ("/api/integrations", "/api/integrations/gog"):
        assert "super-secret" not in auth_client.get(path).text


# --- entries and sync --------------------------------------------------------------------


def test_entries_report_each_status(auth_client, db_session):
    matched = _game(db_session, "Matched", igdb_id=1)
    synced = _game(db_session, "Synced", igdb_id=2)
    _entry(db_session, 1, matched, name="Matched")
    _entry(db_session, 2, synced, name="Synced")
    _entry(db_session, 3, None, name="Unmatched")
    _entry(db_session, 4, None, dismissed=True, name="Ignored")
    auth_client.post("/api/integrations/gog/sync", json={"gogProductIds": [2]})

    statuses = {row["gogProductId"]: row["status"] for row in auth_client.get("/api/integrations/gog/entries").json()}

    assert statuses == {1: "new", 2: "up_to_date", 3: "no_match", 4: "ignored"}


def test_sync_adds_an_owned_digital_gog_copy_on_pc(auth_client, db_session):
    game = _game(db_session)
    _entry(db_session, game=game)

    response = auth_client.post("/api/integrations/gog/sync", json={"gogProductIds": [1207664663]})

    assert response.json() == {"synced": 1, "failed": 0, "failures": []}
    [item] = db_session.query(LibraryItem).filter(LibraryItem.game_id == game.id).all()
    assert item.status == LibraryStatus.OWNED
    assert item.format == MediaFormat.DIGITAL
    assert item.digital_storefront == "GOG"
    assert item.platform.slug == "win"


def test_sync_twice_adds_only_one_copy(auth_client, db_session):
    game = _game(db_session)
    _entry(db_session, game=game)

    auth_client.post("/api/integrations/gog/sync", json={"gogProductIds": [1207664663]})
    auth_client.post("/api/integrations/gog/sync", json={"gogProductIds": [1207664663]})

    assert db_session.query(LibraryItem).filter(LibraryItem.game_id == game.id).count() == 1


def test_a_steam_copy_does_not_count_as_the_gog_copy(auth_client, db_session, seed_pc_platform):
    game = _game(db_session)
    _entry(db_session, game=game)
    db_session.add(
        LibraryItem(
            game_id=game.id,
            platform_id=seed_pc_platform.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.DIGITAL,
            digital_storefront="Steam",
        )
    )
    db_session.commit()

    [row] = auth_client.get("/api/integrations/gog/entries").json()

    assert row["status"] == "new"


def test_sync_brings_owned_dlc_along(auth_client, db_session):
    parent = _game(db_session, "Base Game", igdb_id=1)
    dlc = _game(db_session, "Expansion", igdb_id=2, parent_game_id=parent.id, category=GameCategory.EXPANSION)
    _entry(db_session, 1, parent, name="Base Game")
    _entry(db_session, 2, dlc, name="Expansion")

    auth_client.post("/api/integrations/gog/sync", json={"gogProductIds": [1]})

    assert db_session.query(LibraryItem).filter(LibraryItem.game_id == dlc.id).count() == 1
    rows = {row["gogProductId"]: row for row in auth_client.get("/api/integrations/gog/entries").json()}
    assert rows[2]["parentGameId"] == parent.id
    assert rows[2]["status"] == "up_to_date"


def test_sync_of_unknown_and_unmatched_ids(auth_client, db_session):
    _entry(db_session, 3, None, name="Unmatched")

    body = auth_client.post("/api/integrations/gog/sync", json={"gogProductIds": [3, 404]}).json()

    assert body["synced"] == 1
    assert body["failed"] == 1
    assert body["failures"][0]["gogProductId"] == 404
    assert db_session.query(LibraryItem).count() == 0


# --- ignore, relink, unlink --------------------------------------------------------------


def test_ignore_and_unignore(auth_client, db_session):
    _entry(db_session, game=_game(db_session))

    assert auth_client.post("/api/integrations/gog/1207664663/ignore").json()["status"] == "ignored"
    assert auth_client.post("/api/integrations/gog/1207664663/unignore").json()["status"] == "new"


def test_bulk_ignore_reports_failures_per_id(auth_client, db_session):
    _entry(db_session, 1, None, name="A")

    body = auth_client.post("/api/integrations/gog/ignore", json={"gogProductIds": [1, 404]}).json()

    assert body["ignored"] == 1
    assert body["failed"] == 1
    assert db_session.query(GogLibraryEntry).filter_by(gog_product_id=1).one().dismissed is True


def test_relink_and_unlink(auth_client, db_session):
    _entry(db_session, game=_game(db_session, "Wrong", igdb_id=1))
    right = _game(db_session, "Right", igdb_id=2)

    relinked = auth_client.post("/api/integrations/gog/1207664663/relink", json={"gameId": right.id}).json()
    assert relinked["gameId"] == right.id
    assert relinked["gameName"] == "Right"

    unlinked = auth_client.post("/api/integrations/gog/1207664663/unlink").json()
    assert unlinked["gameId"] is None
    assert unlinked["status"] == "no_match"


def test_relink_to_a_game_another_entry_owns_is_a_conflict(auth_client, db_session):
    taken = _game(db_session, "Taken", igdb_id=1)
    _entry(db_session, 1, taken, name="Taken")
    _entry(db_session, 2, None, name="Other")

    response = auth_client.post("/api/integrations/gog/2/relink", json={"gameId": taken.id})

    assert response.status_code == 409


def test_relink_to_a_missing_game_is_a_404(auth_client, db_session):
    _entry(db_session, 2, None, name="Other")

    assert auth_client.post("/api/integrations/gog/2/relink", json={"gameId": 9999}).status_code == 404


def test_actions_on_an_unknown_entry_are_404(auth_client):
    assert auth_client.post("/api/integrations/gog/404/ignore").status_code == 404
    assert auth_client.post("/api/integrations/gog/404/unlink").status_code == 404


# --- store details and custom games ------------------------------------------------------


@respx.mock
def test_store_details(auth_client):
    respx.get(f"{GOG_API_BASE}/v2/games/5").mock(
        return_value=httpx.Response(
            200,
            json={
                "_embedded": {"product": {"title": "Obscure Thing"}},
                "_links": {"boxArtImage": {"href": "https://images.gog-statics.com/box.jpg"}},
                "description": "<p>A summary.</p>",
            },
        )
    )

    body = auth_client.get("/api/integrations/gog/5/store-details").json()

    assert body == {
        "name": "Obscure Thing",
        "summary": "A summary.",
        "coverUrl": "https://images.gog-statics.com/box.jpg",
    }


@respx.mock
def test_store_details_for_a_missing_product_is_a_404(auth_client):
    respx.get(f"{GOG_API_BASE}/v2/games/5").mock(return_value=httpx.Response(404))

    assert auth_client.get("/api/integrations/gog/5/store-details").status_code == 404


def test_a_custom_game_from_gog_sync_links_its_entry(auth_client, db_session):
    _entry(db_session, 5, None, name="Obscure Thing")

    response = auth_client.post("/api/games/manual", json={"name": "Obscure Thing", "gogProductId": 5})

    assert response.status_code in (200, 201)
    [row] = auth_client.get("/api/integrations/gog/entries").json()
    assert row["gameId"] == response.json()["id"]
    assert row["status"] == "new"


# --- cleanup when games go away ----------------------------------------------------------


def test_deleting_a_game_unmatches_its_entry_and_drops_its_downloads(auth_client, db_session):
    game = _game(db_session)
    _entry(db_session, game=game)
    db_session.add(GogDownload(game_id=game.id, gog_product_id=1207664663, installer_id="i", file_id="f"))
    db_session.commit()

    assert auth_client.delete(f"/api/games/{game.id}").status_code in (200, 204)

    db_session.expire_all()
    [row] = auth_client.get("/api/integrations/gog/entries").json()
    assert row["status"] == "no_match"
    assert db_session.query(GogDownload).count() == 0


# --- wishlist ----------------------------------------------------------------------------


def _wish(db_session, gog_product_id=1423049311, game=None, dismissed=False, name="Cyberpunk 2077"):
    entry = GogWishlistEntry(
        gog_product_id=gog_product_id, gog_name=name, game_id=game.id if game else None, dismissed=dismissed
    )
    db_session.add(entry)
    db_session.commit()
    return entry


def test_wishlist_entries_report_each_status(auth_client, db_session, seed_platform):
    wanted = _game(db_session, "Wanted", igdb_id=1)
    tracked = _game(db_session, "Tracked", igdb_id=2)
    db_session.add(LibraryItem(game_id=tracked.id, platform_id=seed_platform.id, status=LibraryStatus.WISHLIST))
    db_session.commit()
    _wish(db_session, 1, wanted, name="Wanted")
    _wish(db_session, 2, tracked, name="Tracked")
    _wish(db_session, 3, None, name="Unmatched")
    _wish(db_session, 4, None, dismissed=True, name="Ignored")

    rows = auth_client.get("/api/integrations/gog/wishlist/entries").json()

    assert {row["gogProductId"]: row["status"] for row in rows} == {
        1: "new",
        2: "already_wishlisted",
        3: "no_match",
        4: "ignored",
    }


def test_wishlist_sync_adds_a_pc_digital_gog_wishlist_copy_with_wishlisted_dlc(auth_client, db_session):
    base = _game(db_session, "Base Game", igdb_id=1)
    dlc = _game(db_session, "Expansion", igdb_id=2, parent_game_id=base.id, category=GameCategory.EXPANSION)
    _wish(db_session, 1, base, name="Base Game")
    _wish(db_session, 2, dlc, name="Expansion")

    body = auth_client.post("/api/integrations/gog/wishlist/sync", json={"gogProductIds": [1]}).json()

    assert body == {"synced": 1, "failed": 0, "failures": []}
    for game in (base, dlc):
        [item] = db_session.query(LibraryItem).filter(LibraryItem.game_id == game.id).all()
        assert item.status == LibraryStatus.WISHLIST
        assert item.format == MediaFormat.DIGITAL
        assert item.digital_storefront == "GOG"
        assert item.platform.slug == "win"
    statuses = {
        row["gogProductId"]: row["status"] for row in auth_client.get("/api/integrations/gog/wishlist/entries").json()
    }
    assert statuses == {1: "already_wishlisted", 2: "already_wishlisted"}


def test_wishlist_ignore_relink_unlink(auth_client, db_session):
    _wish(db_session, 5, _game(db_session, "Wrong", igdb_id=1), name="Thing")
    right = _game(db_session, "Right", igdb_id=2)

    assert auth_client.post("/api/integrations/gog/wishlist/5/ignore").json()["status"] == "ignored"
    assert auth_client.post("/api/integrations/gog/wishlist/5/unignore").json()["status"] == "new"
    assert (
        auth_client.post("/api/integrations/gog/wishlist/5/relink", json={"gameId": right.id}).json()["gameName"]
        == "Right"
    )
    assert auth_client.post("/api/integrations/gog/wishlist/5/unlink").json()["status"] == "no_match"
    bulk = auth_client.post("/api/integrations/gog/wishlist/ignore", json={"gogProductIds": [5, 404]}).json()
    assert bulk["ignored"] == 1
    assert bulk["failed"] == 1


def test_wishlist_and_owned_routes_are_separate(auth_client, db_session):
    _wish(db_session, 5, None, name="Only Wishlisted")

    assert auth_client.get("/api/integrations/gog/entries").json() == []
    assert auth_client.post("/api/integrations/gog/5/ignore").status_code == 404


def test_a_custom_game_from_a_wishlist_row_links_that_row(auth_client, db_session):
    _wish(db_session, 6, None, name="Obscure Wish")

    created = auth_client.post("/api/games/manual", json={"name": "Obscure Wish", "gogProductId": 6}).json()

    [row] = auth_client.get("/api/integrations/gog/wishlist/entries").json()
    assert row["gameId"] == created["id"]


def test_deleting_a_game_unmatches_its_wishlist_entry(auth_client, db_session):
    game = _game(db_session)
    _wish(db_session, 7, game, name="Doomed")

    auth_client.delete(f"/api/games/{game.id}")

    db_session.expire_all()
    [row] = auth_client.get("/api/integrations/gog/wishlist/entries").json()
    assert row["status"] == "no_match"
