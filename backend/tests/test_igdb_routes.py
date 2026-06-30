import io

import httpx
import respx
from PIL import Image

from app.core.config import UPLOADS_DIR
from app.models.catalog import Game, GameCategory
from app.models.library import LibraryItem, LibraryStatus, Note
from app.services import upload_service
from app.services.igdb_client import IGDB_API_BASE, IGDB_TOKEN_URL

TOKEN_RESPONSE = httpx.Response(200, json={"access_token": "test-token", "expires_in": 3600})


def test_igdb_search_requires_auth(client):
    response = client.get("/api/igdb/search", params={"query": "zelda"})

    assert response.status_code == 401


@respx.mock
def test_igdb_search_returns_mapped_results(auth_client, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "id": 1942,
                    "name": "Old School Game",
                    "slug": "old-school-game",
                    "cover": 500,
                    "game_type": 9,  # remaster
                }
            ],
        )
    )
    respx.post(f"{IGDB_API_BASE}/covers").mock(
        return_value=httpx.Response(200, json=[{"id": 500, "url": "//images.igdb.com/t_thumb/x.jpg"}])
    )

    response = auth_client.get("/api/igdb/search", params={"query": "old school"})

    assert response.status_code == 200
    [result] = response.json()
    assert result["igdbId"] == 1942
    assert result["name"] == "Old School Game"
    assert result["coverUrl"] == "https://images.igdb.com/t_720p/x.jpg"
    assert result["category"] == "remaster"


@respx.mock
def test_igdb_search_by_id_syntax_returns_single_match(auth_client, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    games_route = respx.post(f"{IGDB_API_BASE}/games").mock(
        return_value=httpx.Response(
            200,
            json=[{"id": 3542, "name": "Monster Truck Madness 2", "slug": "monster-truck-madness-2", "category": 0}],
        )
    )

    response = auth_client.get("/api/igdb/search", params={"query": "igdb:3542"})

    assert response.status_code == 200
    [result] = response.json()
    assert result["igdbId"] == 3542
    assert result["name"] == "Monster Truck Madness 2"
    # Confirms it took the id-lookup path (where id = (...)), not a name search.
    assert "where id = (3542)" in games_route.calls.last.request.content.decode()


@respx.mock
def test_igdb_search_by_id_syntax_returns_empty_for_unknown_id(auth_client, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(return_value=httpx.Response(200, json=[]))

    response = auth_client.get("/api/igdb/search", params={"query": "igdb:999999999"})

    assert response.status_code == 200
    assert response.json() == []


@respx.mock
def test_igdb_search_treats_non_id_query_as_name_search(auth_client, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    games_route = respx.post(f"{IGDB_API_BASE}/games").mock(
        return_value=httpx.Response(200, json=[{"id": 1, "name": "igdb:nonsense", "category": 0}])
    )

    response = auth_client.get("/api/igdb/search", params={"query": "igdb:nonsense"})

    assert response.status_code == 200
    assert 'search "igdb:nonsense"' in games_route.calls.last.request.content.decode()


@respx.mock
def test_igdb_search_default_scope_queries_browsable_game_types(auth_client, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    games_route = respx.post(f"{IGDB_API_BASE}/games").mock(return_value=httpx.Response(200, json=[]))

    response = auth_client.get("/api/igdb/search", params={"query": "zelda"})

    assert response.status_code == 200
    body = games_route.calls.last.request.content.decode()
    assert "game_type = (0,3,4,8,9,10) | game_type = null" in body


@respx.mock
def test_igdb_search_addon_scope_queries_hierarchical_game_types(auth_client, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    games_route = respx.post(f"{IGDB_API_BASE}/games").mock(return_value=httpx.Response(200, json=[]))

    response = auth_client.get("/api/igdb/search", params={"query": "season pass", "categoryScope": "addon"})

    assert response.status_code == 200
    body = games_route.calls.last.request.content.decode()
    assert "game_type = (1,2,13)" in body
    assert "game_type = null" not in body


@respx.mock
def test_igdb_search_includes_parent_game_when_present(auth_client, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "id": 9001,
                    "name": "Real DLC Name",
                    "game_type": 1,
                    "parent_game": {"id": 9000, "name": "Real Parent Game"},
                }
            ],
        )
    )

    response = auth_client.get("/api/igdb/search", params={"query": "igdb:9001"})

    assert response.status_code == 200
    [result] = response.json()
    assert result["parentGame"] == {"igdbId": 9000, "name": "Real Parent Game"}


@respx.mock
def test_igdb_search_parent_game_is_null_when_absent(auth_client, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        return_value=httpx.Response(200, json=[{"id": 1942, "name": "Old School Game", "game_type": 9}])
    )

    response = auth_client.get("/api/igdb/search", params={"query": "igdb:1942"})

    assert response.status_code == 200
    [result] = response.json()
    assert result["parentGame"] is None


@respx.mock
def test_import_game_creates_game_and_addons(auth_client, db_session, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(200, json=[{"id": 1942, "name": "Main Game", "slug": "main-game", "category": 0}]),
            httpx.Response(
                200,
                json=[
                    {"id": 1943, "name": "Main Game Season Pass", "category": 1},
                ],
            ),
        ]
    )

    response = auth_client.post("/api/games", json={"igdbId": 1942})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Main Game"
    assert body["category"] == "main_game"

    addon = db_session.query(Game).filter_by(igdb_id=1943).one()
    assert addon.category.value == "dlc_addon"
    assert addon.parent_game_id == body["id"]


@respx.mock
def test_import_game_cascade_discovered_standalone_expansion_is_display_only(auth_client, db_session, igdb_client):
    # get_addons_by_parent_igdb_id now filters to hierarchical game_types server-side, so
    # IGDB shouldn't actually return a standalone expansion here in practice — but this
    # exercises _upsert_from_igdb_payload's own safety net regardless: *if* something
    # non-hierarchical ever did come back from that endpoint, it must still end up
    # display-only, not structurally hidden, exactly like one found via direct import (see
    # the two tests below). This is what regressed Miles Morales: the cascade loop used to
    # force every discovered child's parent_game_id unconditionally.
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(200, json=[{"id": 1944, "name": "Main Game 2", "slug": "main-game-2", "category": 0}]),
            httpx.Response(
                200,
                json=[
                    {"id": 1945, "name": "Main Game 2: Standalone Spinoff", "game_type": 4},
                ],
            ),
        ]
    )

    response = auth_client.post("/api/games", json={"igdbId": 1944})

    assert response.status_code == 201
    body = response.json()

    addon = db_session.query(Game).filter_by(igdb_id=1945).one()
    assert addon.category.value == "standalone_expansion"
    assert addon.parent_game_id is None
    assert addon.display_parent_game_id == body["id"]

    games_list = auth_client.get("/api/games").json()
    assert addon.id in [g["id"] for g in games_list]


@respx.mock
def test_import_game_links_hierarchical_addon_to_parent_already_in_library(
    auth_client, db_session, igdb_client, seed_game
):
    # seed_game's igdb_id stands in for an already-imported "original" game. DLC/expansion/
    # pack are hierarchical (they extend an existing copy), so the addon being imported now
    # should set the *structural* parent_game_id via IGDB's parent_game backlink.
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(
                200,
                json=[
                    {
                        "id": 5001,
                        "name": "Some Expansion",
                        "game_type": 2,  # expansion
                        "parent_game": {"id": seed_game.igdb_id, "name": seed_game.name, "url": "https://igdb.com/x"},
                    }
                ],
            ),
            httpx.Response(200, json=[]),  # no addons
        ]
    )

    response = auth_client.post("/api/games", json={"igdbId": 5001})

    assert response.status_code == 201
    body = response.json()
    assert body["parentGameId"] == seed_game.id
    assert body["parentGameName"] == seed_game.name
    assert body["displayParentGameId"] is None
    assert body["externalParentName"] is None
    assert body["externalParentIgdbUrl"] is None


@respx.mock
def test_import_game_links_non_hierarchical_addon_as_display_only(auth_client, db_session, igdb_client, seed_game):
    # A standalone expansion (Miles Morales' real category) is independently owned/played —
    # it must NOT get the structural parent_game_id (that would hide it from the main games
    # list, see list_top_level_games), just a display-only link to the local parent.
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(
                200,
                json=[
                    {
                        "id": 5003,
                        "name": "Some Standalone Expansion",
                        "game_type": 4,  # standalone_expansion
                        "parent_game": {"id": seed_game.igdb_id, "name": seed_game.name, "url": "https://igdb.com/x"},
                    }
                ],
            ),
            httpx.Response(200, json=[]),  # no addons
        ]
    )

    response = auth_client.post("/api/games", json={"igdbId": 5003})

    assert response.status_code == 201
    body = response.json()
    assert body["parentGameId"] is None
    assert body["displayParentGameId"] == seed_game.id
    assert body["displayParentGameName"] == seed_game.name
    assert body["externalParentName"] is None
    assert body["externalParentIgdbUrl"] is None

    # The whole point of display_parent_game_id over parent_game_id: this still shows up in
    # the main games list rather than only being reachable via the parent's Addons tab.
    games_list = auth_client.get("/api/games").json()
    assert body["id"] in [g["id"] for g in games_list]


@respx.mock
def test_import_game_caches_external_parent_when_not_in_library(auth_client, db_session, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(
                200,
                json=[
                    {
                        "id": 5002,
                        "name": "Age of Empires: Definitive Edition",
                        "game_type": 9,
                        "parent_game": {
                            "id": 289,
                            "name": "Age of Empires",
                            "url": "https://www.igdb.com/games/age-of-empires",
                        },
                    }
                ],
            ),
            httpx.Response(200, json=[]),  # no addons
        ]
    )

    response = auth_client.post("/api/games", json={"igdbId": 5002})

    assert response.status_code == 201
    body = response.json()
    assert body["parentGameId"] is None
    assert body["displayParentGameId"] is None
    assert body["externalParentName"] == "Age of Empires"
    assert body["externalParentIgdbUrl"] == "https://www.igdb.com/games/age-of-empires"


def test_import_game_returns_503_when_igdb_not_configured(auth_client, igdb_client):
    igdb_client._client_id = None
    igdb_client._client_secret = None

    response = auth_client.post("/api/games", json={"igdbId": 1942})

    assert response.status_code == 503


@respx.mock
def test_resync_game_updates_existing_record(auth_client, db_session, seed_game, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(
                200,
                json=[{"id": seed_game.igdb_id, "name": "Test Game (Updated)", "category": 0}],
            ),
            httpx.Response(200, json=[]),  # no addons
        ]
    )

    response = auth_client.post(f"/api/games/{seed_game.id}/resync")

    assert response.status_code == 200
    assert response.json()["name"] == "Test Game (Updated)"
    assert response.json()["id"] == seed_game.id


def test_resync_game_404_for_missing_game(auth_client, igdb_client):
    response = auth_client.post("/api/games/999999/resync")

    assert response.status_code == 404


@respx.mock
def test_link_game_to_igdb_resyncs_in_place(auth_client, db_session, igdb_client):
    manual_game = Game(name="My Homebrew Game", category=None)
    db_session.add(manual_game)
    db_session.commit()

    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(200, json=[{"id": 4242, "name": "Real Game Name", "category": 0}]),
            httpx.Response(200, json=[]),  # no addons
        ]
    )

    response = auth_client.post(f"/api/games/{manual_game.id}/link-igdb", json={"igdbId": 4242})

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == manual_game.id
    assert body["igdbId"] == 4242
    assert body["name"] == "Real Game Name"


@respx.mock
def test_link_game_to_igdb_deletes_uploaded_cover(auth_client, db_session, igdb_client):
    image_bytes = io.BytesIO()
    Image.new("RGB", (10, 10), color="blue").save(image_bytes, format="PNG")
    uploaded_url = upload_service.save_cover_image(image_bytes.getvalue())
    uploaded_path = UPLOADS_DIR / "covers" / uploaded_url.removeprefix("/uploads/covers/")
    assert uploaded_path.is_file()

    manual_game = Game(name="My Homebrew Game", category=None, cover_url=uploaded_url)
    db_session.add(manual_game)
    db_session.commit()

    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(
                200, json=[{"id": 8001, "name": "Real Game", "category": 0, "cover_url": "https://igdb.example/x.jpg"}]
            ),
            httpx.Response(200, json=[]),  # no addons
        ]
    )

    response = auth_client.post(f"/api/games/{manual_game.id}/link-igdb", json={"igdbId": 8001})

    assert response.status_code == 200
    assert response.json()["coverUrl"] == "https://igdb.example/x.jpg"
    assert not uploaded_path.exists()


def test_link_game_to_igdb_404_for_missing_game(auth_client, igdb_client):
    response = auth_client.post("/api/games/999999/link-igdb", json={"igdbId": 1})

    assert response.status_code == 404


def test_link_game_to_igdb_conflict_when_already_linked(auth_client, igdb_client, seed_game):
    response = auth_client.post(f"/api/games/{seed_game.id}/link-igdb", json={"igdbId": 5555})

    assert response.status_code == 409


def test_link_game_to_igdb_conflict_when_igdb_id_already_used(auth_client, db_session, igdb_client, seed_game):
    manual_game = Game(name="My Homebrew Game", category=None)
    db_session.add(manual_game)
    db_session.commit()

    response = auth_client.post(f"/api/games/{manual_game.id}/link-igdb", json={"igdbId": seed_game.igdb_id})

    assert response.status_code == 409


@respx.mock
def test_link_game_to_igdb_preserves_existing_parent(auth_client, db_session, igdb_client, seed_game):
    manual_addon = Game(name="Homebrew DLC", category=None, parent_game_id=seed_game.id)
    db_session.add(manual_addon)
    db_session.commit()

    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(200, json=[{"id": 7777, "name": "Real DLC Name", "category": 1}]),
            httpx.Response(200, json=[]),  # no addons
        ]
    )

    response = auth_client.post(f"/api/games/{manual_addon.id}/link-igdb", json={"igdbId": 7777})

    assert response.status_code == 200
    body = response.json()
    assert body["parentGameId"] == seed_game.id


@respx.mock
def test_link_via_parent_imports_parent_and_merges_original(auth_client, db_session, igdb_client, seed_platform):
    manual_addon = Game(name="Homebrew DLC Placeholder", category=GameCategory.DLC_ADDON)
    db_session.add(manual_addon)
    db_session.commit()
    db_session.add(LibraryItem(game_id=manual_addon.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.add(Note(game_id=manual_addon.id, body="My placeholder notes"))
    db_session.commit()

    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            # 1. get_games_by_ids([9001]) — resolve the addon's parent before importing it.
            httpx.Response(
                200,
                json=[
                    {
                        "id": 9001,
                        "name": "Real DLC Name",
                        "game_type": 1,
                        "parent_game": {"id": 9000, "name": "Real Parent Game"},
                    }
                ],
            ),
            # 2. import_game_from_igdb(9000) -> get_games_by_ids([9000])
            httpx.Response(200, json=[{"id": 9000, "name": "Real Parent Game", "game_type": 0}]),
            # 3. import_game_from_igdb(9000) -> get_addons_by_parent_igdb_id(9000)
            httpx.Response(200, json=[{"id": 9001, "name": "Real DLC Name", "game_type": 1}]),
        ]
    )

    response = auth_client.post(f"/api/games/{manual_addon.id}/link-igdb-via-parent", json={"igdbId": 9001})

    assert response.status_code == 200
    body = response.json()
    assert body["igdbId"] == 9001
    assert body["id"] != manual_addon.id
    assert body["parentGameId"] is not None

    assert db_session.get(Game, manual_addon.id) is None
    assert db_session.query(LibraryItem).filter_by(game_id=body["id"]).one().status == LibraryStatus.OWNED
    assert db_session.query(Note).filter_by(game_id=body["id"]).one().body == "My placeholder notes"


def test_link_via_parent_404_for_missing_game(auth_client, igdb_client):
    response = auth_client.post("/api/games/999999/link-igdb-via-parent", json={"igdbId": 1})

    assert response.status_code == 404


def test_link_via_parent_conflict_when_already_linked(auth_client, igdb_client, seed_game):
    response = auth_client.post(f"/api/games/{seed_game.id}/link-igdb-via-parent", json={"igdbId": 5555})

    assert response.status_code == 409


@respx.mock
def test_link_via_parent_conflict_when_addon_has_no_parent(auth_client, db_session, igdb_client):
    manual_addon = Game(name="Homebrew DLC Placeholder", category=GameCategory.DLC_ADDON)
    db_session.add(manual_addon)
    db_session.commit()

    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        return_value=httpx.Response(200, json=[{"id": 9001, "name": "Real DLC Name", "game_type": 1}])
    )

    response = auth_client.post(f"/api/games/{manual_addon.id}/link-igdb-via-parent", json={"igdbId": 9001})

    assert response.status_code == 409
