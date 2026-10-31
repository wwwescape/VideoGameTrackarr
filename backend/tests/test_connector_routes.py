import asyncio

import httpx
import pytest
import respx

from app.models.catalog import Game
from app.models.connector import Connector, ConnectorAbsentMode, ConnectorKind
from app.models.igdb_import import IgdbImportEntry
from app.models.library import LibraryItem, LibraryStatus
from app.services import connector_service, job_registry, nintendo_titledb
from app.services.store_clients import StoreGame, StoreSession


@pytest.fixture(autouse=True)
def triggered_jobs(monkeypatch):
    """The IGDB Import jobs a sync starts, recorded rather than run: they'd call IGDB."""
    started: list[str] = []
    monkeypatch.setattr(job_registry, "trigger_run", lambda job_id, session_factory: started.append(job_id))
    return started


def _create(auth_client, **overrides):
    body = {"name": "Steam Deck", "slug": "steam-deck", "kind": "custom", **overrides}
    response = auth_client.post("/api/connectors", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _pair(client, slug: str) -> str:
    """Pairs a device the whole way (pair, approve, poll) and returns its token."""
    pairing = client.post(f"/api/connect/{slug}/pair", json={"deviceName": "Deck"}).json()
    assert client.post(f"/api/connectors/pairings/{pairing['code']}/approve").status_code == 200
    polled = client.post(f"/api/connect/{slug}/pair/poll", json={"pollToken": pairing["pollToken"]}).json()
    return polled["token"]


def test_connectors_are_created_listed_edited_and_deleted(auth_client, seed_platform):
    created = _create(auth_client, platformId=seed_platform.id, mediaFormat="digital", digitalStorefront="Steam")

    assert created["slug"] == "steam-deck"
    assert created["signedIn"] is False
    assert [c["name"] for c in auth_client.get("/api/connectors").json()] == ["Steam Deck"]

    edited = auth_client.put(
        f"/api/connectors/{created['id']}", json={"name": "Deck", "slug": "deck", "absentMode": "note"}
    ).json()
    assert (edited["name"], edited["slug"], edited["absentMode"], edited["kind"]) == ("Deck", "deck", "note", "custom")

    assert auth_client.delete(f"/api/connectors/{created['id']}").status_code == 204
    assert auth_client.get("/api/connectors").json() == []


def test_a_connector_address_must_be_unique_and_url_safe(auth_client):
    _create(auth_client)

    assert auth_client.post("/api/connectors", json={"name": "Again", "slug": "steam-deck"}).status_code == 409
    assert auth_client.post("/api/connectors", json={"name": "Bad", "slug": "Steam Deck!"}).status_code == 422


def test_a_device_pairs_once_its_code_is_approved_and_gets_its_token_once(auth_client):
    _create(auth_client)
    pairing = auth_client.post("/api/connect/steam-deck/pair", json={"deviceName": "Deck"}).json()
    poll = {"pollToken": pairing["pollToken"]}

    pending = auth_client.post("/api/connect/steam-deck/pair/poll", json=poll).json()
    assert pending == {"status": "pending", "token": None}
    info = auth_client.get(f"/api/connectors/pairings/{pairing['code']}").json()
    assert (info["deviceName"], info["connectorName"]) == ("Deck", "Steam Deck")

    auth_client.post(f"/api/connectors/pairings/{pairing['code']}/approve")
    approved = auth_client.post("/api/connect/steam-deck/pair/poll", json=poll).json()
    assert approved["status"] == "approved" and approved["token"]
    # Handed over once: the pairing is gone after that.
    assert auth_client.post("/api/connect/steam-deck/pair/poll", json=poll).json()["status"] == "expired"
    assert auth_client.get("/api/connectors").json()[0]["devices"][0]["name"] == "Deck"


def test_approving_a_code_needs_someone_signed_in(client, auth_client):
    _create(auth_client)
    code = auth_client.post("/api/connect/steam-deck/pair", json={}).json()["code"]
    client.headers.pop("Authorization")

    assert client.post(f"/api/connectors/pairings/{code}/approve").status_code == 401


def test_sync_needs_a_paired_device_token(auth_client):
    _create(auth_client)

    response = auth_client.post(
        "/api/connect/steam-deck/sync", json={"games": []}, headers={"Authorization": "Bearer nope"}
    )

    assert response.status_code == 401


def test_sync_reuses_library_games_and_adds_the_rest_as_custom_games(
    auth_client, db_session, seed_game, seed_platform, triggered_jobs
):
    connector = _create(auth_client, platformId=seed_platform.id)
    token = _pair(auth_client, "steam-deck")
    games = [
        {"id": "a", "name": "test game™"},
        {"id": "b", "name": "Brand New Game"},
        {"id": "c", "name": "Linked Game", "igdbId": 4242, "players": 4},
    ]

    response = auth_client.post(
        "/api/connect/steam-deck/sync", json={"games": games}, headers={"Authorization": f"Bearer {token}"}
    )

    assert response.json() == {"added": 2, "existing": 1, "absent": 0, "unknown": []}
    # The existing game got a copy with the connector's defaults instead of a duplicate.
    [copy] = db_session.query(LibraryItem).filter_by(game_id=seed_game.id).all()
    assert (copy.platform_id, copy.status) == (seed_platform.id, LibraryStatus.OWNED)
    new = db_session.query(Game).filter_by(name="Brand New Game").one()
    assert new.igdb_id is None
    linked = db_session.query(Game).filter_by(name="Linked Game").one()
    assert linked.local_players_fallback == 4
    entry = db_session.query(IgdbImportEntry).filter_by(game_id=linked.id).one()
    assert (entry.match_igdb_id, entry.queued) == (4242, True)
    assert sorted(triggered_jobs) == ["igdb_link", "igdb_match"]
    assert auth_client.get("/api/connectors").json()[0]["presentCount"] == 3
    assert connector["id"]


@pytest.mark.parametrize("mode", ["note", "remove"])
def test_a_complete_sync_handles_games_no_longer_reported(auth_client, db_session, seed_platform, mode):
    _create(auth_client, platformId=seed_platform.id, absentMode=mode)
    token = _pair(auth_client, "steam-deck")
    kept, gone = {"id": "a", "name": "Kept"}, {"id": "b", "name": "Gone"}

    def sync(*games, complete=True):
        return auth_client.post(
            "/api/connect/steam-deck/sync",
            json={"games": list(games), "complete": complete},
            headers={"Authorization": f"Bearer {token}"},
        )

    sync(kept, gone)
    result = sync(kept)

    assert result.json()["absent"] == 1
    gone_game = db_session.query(Game).filter_by(name="Gone").one()
    copies = db_session.query(LibraryItem).filter_by(game_id=gone_game.id).all()
    if mode == "note":
        assert copies[0].notes == "No longer reported by Steam Deck."
        # Reported again: the note goes.
        sync(gone, complete=False)
        db_session.expire_all()
        assert db_session.get(LibraryItem, copies[0].id).notes is None
    else:
        assert copies == []


def test_nx_remote_launcher_names_title_ids_from_the_nintendo_title_database(auth_client, db_session, monkeypatch):
    index = {"01004EA00DF70000": {"name": "PICO PARK", "players": 8}}
    monkeypatch.setattr(nintendo_titledb, "load_index", lambda: index)
    connector_service.ensure_builtin_connectors(db_session)
    token = _pair(auth_client, "switch")

    response = auth_client.post(
        "/api/connect/switch/sync",
        # An update's title ID, lowercase, and an ID the database doesn't know.
        json={"games": [{"id": "01004ea00df70800"}, {"id": "0100FFFFFFFFF000"}]},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.json() == {"added": 1, "existing": 0, "absent": 0, "unknown": ["0100FFFFFFFFF000"]}
    pico = db_session.query(Game).filter_by(name="PICO PARK").one()
    assert (pico.local_players_fallback, pico.local_players_fallback_source) == (8, "nintendo")


def test_the_nintendo_switch_connector_is_built_in(auth_client, db_session):
    connector_service.ensure_builtin_connectors(db_session)
    connector_service.ensure_builtin_connectors(db_session)
    builtin = db_session.query(Connector).filter_by(kind=ConnectorKind.NX_REMOTE_LAUNCHER).one()
    assert (builtin.name, builtin.slug, builtin.absent_mode) == ("Nintendo Switch", "switch", ConnectorAbsentMode.NOTE)

    # It can't be deleted, nor can a second one be made; it can still be renamed.
    assert auth_client.delete(f"/api/connectors/{builtin.id}").status_code == 409
    second = {"name": "Switch 2", "slug": "switch-2", "kind": "nx_remote_launcher"}
    assert auth_client.post("/api/connectors", json=second).status_code == 409
    edited = auth_client.put(f"/api/connectors/{builtin.id}", json={"name": "Ma Switch", "slug": "ma-switch"})
    assert (edited.status_code, edited.json()["slug"]) == (200, "ma-switch")


def test_the_built_in_connector_comes_back_if_missing_and_avoids_a_taken_address(db_session):
    db_session.add(Connector(name="Mine", slug="switch", kind=ConnectorKind.CUSTOM))
    db_session.commit()

    connector_service.ensure_builtin_connectors(db_session)

    builtin = db_session.query(Connector).filter_by(kind=ConnectorKind.NX_REMOTE_LAUNCHER).one()
    assert builtin.slug == "nintendo-switch"


def test_a_csv_connector_only_adds_the_file_games(auth_client, db_session):
    connector = _create(auth_client, kind="csv", slug="battlenet")

    response = auth_client.post(
        f"/api/connectors/{connector['id']}/import", json={"games": [{"id": "d4", "name": "Diablo IV"}]}
    )

    assert response.json()["added"] == 1
    assert db_session.query(Game).filter_by(name="Diablo IV").count() == 1


@respx.mock
def test_a_store_connector_signs_in_with_the_pasted_code_and_never_returns_the_token(auth_client, db_session):
    connector = _create(auth_client, kind="epic", slug="epic")
    token_route = respx.post("https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token").mock(
        return_value=httpx.Response(200, json={"access_token": "access", "refresh_token": "refresh"})
    )

    response = auth_client.post(
        f"/api/connectors/{connector['id']}/sign-in",
        json={"code": '{"redirectUrl": "https://localhost", "authorizationCode": "abc123"}'},
    )

    assert response.status_code == 200
    assert response.json()["signedIn"] is True
    assert "refresh" not in response.text
    assert b"code=abc123" in token_route.calls.last.request.content
    assert db_session.get(Connector, connector["id"]).credentials == {"refresh_token": "refresh"}


@respx.mock
def test_a_refused_store_code_is_a_400(auth_client):
    connector = _create(auth_client, kind="gog", slug="gog")
    refused = httpx.Response(400, json={"error_description": "bad code"})
    respx.get("https://auth.gog.com/token").mock(return_value=refused)

    response = auth_client.post(
        f"/api/connectors/{connector['id']}/sign-in", json={"code": "https://embed.gog.com/on_login_success?code=x"}
    )

    assert response.status_code == 400


def test_a_store_pull_links_games_by_their_store_id_and_renews_the_token(db_session, seed_pc_platform, monkeypatch):
    connector = Connector(
        name="GOG",
        slug="gog",
        kind=ConnectorKind.GOG,
        platform_id=seed_pc_platform.id,
        media_format="digital",
        digital_storefront="GOG",
        absent_mode=ConnectorAbsentMode.KEEP,
        credentials={"refresh_token": "old"},
    )
    db_session.add(connector)
    db_session.commit()

    class FakeGog:
        async def start_session(self, *, code=None, refresh_token=None):
            assert refresh_token == "old"
            return StoreSession(refresh_token="new", access_token="access")

        async def owned_games(self, access_token):
            return [StoreGame(id="1207658924", title="The Witcher: Enhanced Edition")]

        async def aclose(self):
            pass

    class FakeIgdb:
        async def get_igdb_id_for_external(self, source, uid):
            assert (source, uid) == (5, "1207658924")
            return 1891

    monkeypatch.setattr(connector_service, "_store_client", lambda connector: FakeGog())

    result = asyncio.run(connector_service.pull(db_session, connector, FakeIgdb()))

    assert result.added == 1
    assert connector.credentials == {"refresh_token": "new"}
    game = db_session.query(Game).filter_by(name="The Witcher: Enhanced Edition").one()
    assert db_session.query(IgdbImportEntry).filter_by(game_id=game.id).one().match_igdb_id == 1891
    copy = db_session.query(LibraryItem).filter_by(game_id=game.id).one()
    assert (copy.digital_storefront, copy.platform_id) == ("GOG", seed_pc_platform.id)
