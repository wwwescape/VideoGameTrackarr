import httpx
import respx

from app.models.catalog import Game, GameCategory
from app.services.igdb_client import IGDB_API_BASE, IGDB_TOKEN_URL

TOKEN_RESPONSE = httpx.Response(200, json={"access_token": "test-token", "expires_in": 3600})

FULL_GAME = {
    "id": 7346,
    "name": "The Legend of Zelda: Breath of the Wild",
    "slug": "the-legend-of-zelda-breath-of-the-wild",
    "summary": "Step into a world of discovery.",
    "storyline": "Link awakens...",
    "url": "https://www.igdb.com/games/the-legend-of-zelda-breath-of-the-wild",
    "first_release_date": 1488499200,
    "game_type": 0,
    "cover": 900,
    "genres": [{"id": 31, "name": "Adventure", "slug": "adventure"}],
    "franchises": [{"id": 596, "name": "The Legend of Zelda", "slug": "the-legend-of-zelda"}],
    "collections": [{"id": 106, "name": "The Legend of Zelda", "slug": "the-legend-of-zelda"}],
    "platforms": [{"id": 130, "name": "Nintendo Switch", "slug": "switch", "abbreviation": "Switch"}],
    "involved_companies": [
        {"company": {"id": 70, "name": "Nintendo", "slug": "nintendo"}, "developer": True, "publisher": True},
        # IGDB can list the same company twice — must not duplicate a role.
        {"company": {"id": 70, "name": "Nintendo", "slug": "nintendo"}, "publisher": True},
    ],
    "screenshots": [{"id": 1, "url": "//images.igdb.com/igdb/image/upload/t_thumb/shot.jpg"}],
    "artworks": [{"id": 2, "url": "//images.igdb.com/igdb/image/upload/t_thumb/art.jpg"}],
    "videos": [{"id": 3, "name": "Trailer", "video_id": "zw47_q9wbBE"}],
    "release_dates": [
        {
            "id": 4,
            "date": 1488499200,
            "human": "Mar 03, 2017",
            "release_region": 8,
            "platform": {"id": 130, "name": "Nintendo Switch"},
        }
    ],
    "websites": [{"url": "https://www.nintendo.com/store/products/zelda", "type": 24}],
}


def _mock_igdb(game_payloads):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(return_value=httpx.Response(200, json=game_payloads))
    respx.post(f"{IGDB_API_BASE}/covers").mock(
        return_value=httpx.Response(
            200, json=[{"id": 900, "url": "//images.igdb.com/igdb/image/upload/t_thumb/cover.jpg"}]
        )
    )


def test_preview_requires_auth(client):
    assert client.get("/api/igdb/games/7346").status_code == 401


@respx.mock
def test_preview_maps_igdb_payload_without_storing_anything(auth_client, igdb_client, db_session):
    _mock_igdb([FULL_GAME])

    response = auth_client.get("/api/igdb/games/7346")

    assert response.status_code == 200
    body = response.json()
    assert body["igdbId"] == 7346
    assert body["name"] == "The Legend of Zelda: Breath of the Wild"
    assert body["category"] == "main_game"
    assert body["summary"] == "Step into a world of discovery."
    assert body["coverUrl"].startswith("https://images.igdb.com/")
    assert [g["name"] for g in body["genres"]] == ["Adventure"]
    assert [f["slug"] for f in body["franchises"]] == ["the-legend-of-zelda"]
    assert [c["name"] for c in body["collections"]] == ["The Legend of Zelda"]
    assert body["platforms"][0]["abbreviation"] == "Switch"
    assert sorted(c["role"] for c in body["companies"]) == ["developer", "publisher"]
    assert len(body["screenshotUrls"]) == 1 and body["screenshotUrls"][0].startswith("https://")
    assert len(body["artworkUrls"]) == 1
    assert body["videos"][0]["videoId"] == "zw47_q9wbBE"
    assert body["releaseDates"][0]["platformName"] == "Nintendo Switch"
    assert body["nintendoStoreUrl"] == "https://www.nintendo.com/store/products/zelda"
    assert body["owned"] is False and body["wishlisted"] is False
    assert body["parentGameId"] is None and body["rating"] is None
    assert body["localGame"] is None
    # A preview never touches the local catalog.
    assert db_session.query(Game).count() == 0


@respx.mock
def test_preview_points_at_the_local_game_when_already_added(auth_client, igdb_client, db_session):
    local = Game(igdb_id=7346, name="Breath of the Wild", slug="botw", category=GameCategory.MAIN_GAME)
    db_session.add(local)
    db_session.commit()
    _mock_igdb([FULL_GAME])

    body = auth_client.get("/api/igdb/games/7346").json()

    assert body["localGame"] == {"slug": "botw", "uuid": local.uuid, "name": "Breath of the Wild"}


@respx.mock
def test_preview_of_an_addon_names_its_external_parent(auth_client, igdb_client):
    addon = {
        "id": 99,
        "name": "The Master Trials",
        "game_type": 1,
        "parent_game": {"id": 7346, "name": "Breath of the Wild", "url": "https://www.igdb.com/games/botw"},
    }
    _mock_igdb([addon])

    body = auth_client.get("/api/igdb/games/99").json()

    assert body["category"] == "dlc_addon"
    assert body["externalParentName"] == "Breath of the Wild"
    assert body["externalParentIgdbUrl"] == "https://www.igdb.com/games/botw"
    assert body["genres"] == [] and body["screenshotUrls"] == []


@respx.mock
def test_preview_404_when_igdb_has_no_such_game(auth_client, igdb_client):
    _mock_igdb([])

    assert auth_client.get("/api/igdb/games/123456789").status_code == 404
