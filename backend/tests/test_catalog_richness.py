import httpx
import respx

from app.models.catalog import (
    Artwork,
    Collection,
    Company,
    Franchise,
    Game,
    GameCollection,
    GameCompany,
    GameFranchise,
    GameGenre,
    GamePlatform,
    GameVideo,
    Genre,
    IgdbReleaseRegion,
    Platform,
    ReleaseDate,
    Screenshot,
)
from app.services.igdb_client import IGDB_API_BASE, IGDB_TOKEN_URL

TOKEN_RESPONSE = httpx.Response(200, json={"access_token": "test-token", "expires_in": 3600})


def _rich_payload(igdb_id: int = 3212, genre_count: int = 1) -> dict:
    genres = [{"id": 12, "name": "RPG", "slug": "rpg"}]
    if genre_count > 1:
        genres.append({"id": 13, "name": "Simulator", "slug": "simulator"})
    return {
        "id": igdb_id,
        "name": "The Sims 4",
        "category": 0,
        "genres": genres,
        "involved_companies": [
            {
                "id": 1,
                "company": {
                    "id": 283,
                    "name": "The Sims Studio",
                    "slug": "the-sims-studio",
                    "logo": {"id": 1, "url": "//images.igdb.com/igdb/image/upload/t_thumb/logo1.jpg"},
                },
                "developer": True,
                "publisher": False,
                "porting": False,
                "supporting": False,
            },
            {
                "id": 2,
                "company": {"id": 1, "name": "Electronic Arts", "slug": "electronic-arts"},
                "developer": False,
                "publisher": True,
                "porting": False,
                "supporting": False,
            },
        ],
        "franchises": [{"id": 979, "name": "The Sims", "slug": "the-sims"}],
        "collections": [{"id": 61, "name": "The Sims Collection", "slug": "the-sims-collection"}],
        "platforms": [{"id": 48, "name": "PlayStation 4", "slug": "ps4--1", "abbreviation": "PS4"}],
        "screenshots": [{"id": 5700, "url": "//images.igdb.com/igdb/image/upload/t_thumb/shot1.jpg"}],
        "artworks": [{"id": 7246, "url": "//images.igdb.com/igdb/image/upload/t_thumb/art1.jpg"}],
        "videos": [{"id": 1872, "name": "Trailer", "video_id": "WjPPjU8OARg"}],
        "release_dates": [
            {
                "id": 20206,
                "date": 1409616000,
                "human": "Sep 02, 2014",
                "release_region": 2,
                "platform": {"id": 48, "name": "PlayStation 4"},
            }
        ],
        "similar_games": [111, 222],
    }


@respx.mock
def test_import_persists_full_catalog_richness(auth_client, db_session, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(200, json=[_rich_payload()]),
            httpx.Response(200, json=[]),  # no addons
        ]
    )

    response = auth_client.post("/api/games", json={"igdbId": 3212})

    assert response.status_code == 201
    body = response.json()
    game_id = body["id"]

    assert [g["name"] for g in body["genres"]] == ["RPG"]
    assert {c["name"]: c["role"] for c in body["companies"]} == {
        "The Sims Studio": "developer",
        "Electronic Arts": "publisher",
    }
    assert body["companies"][0]["logoUrl"] == "https://images.igdb.com/igdb/image/upload/t_thumb/logo1.jpg"
    assert [f["name"] for f in body["franchises"]] == ["The Sims"]
    assert [c["name"] for c in body["collections"]] == ["The Sims Collection"]
    assert [p["name"] for p in body["platforms"]] == ["PlayStation 4"]
    assert body["screenshotUrls"] == ["https://images.igdb.com/igdb/image/upload/t_screenshot_big/shot1.jpg"]
    assert body["artworkUrls"] == ["https://images.igdb.com/igdb/image/upload/t_1080p/art1.jpg"]
    assert [v["videoId"] for v in body["videos"]] == ["WjPPjU8OARg"]
    [release_date] = body["releaseDates"]
    assert release_date["releaseRegion"] == "north_america"
    assert release_date["platformName"] == "PlayStation 4"

    game = db_session.get(Game, game_id)
    assert game.similar_game_igdb_ids == [111, 222]


@respx.mock
def test_resync_response_includes_richness_for_a_game_synced_for_the_first_time(
    auth_client, db_session, seed_game, igdb_client
):
    """Regression test: resync_game() used to fetch the game via get_game_detail() (which
    eager-loads every richness relation) purely to check igdb_id, *before* the sync ran —
    caching those relations as empty on the session's copy of the Game instance. SQLAlchemy
    eager loaders don't re-populate an already-loaded relationship on a cached instance, so
    the response kept serving the pre-sync empty lists even though the right rows were
    correctly written to the database. Only reproduces on a game's *first* resync (where
    the relations were never loaded before in this session) - a second resync masked it,
    since by then the (correct, unchanged) values were already cached. Caught by actually
    resyncing a real game against the live IGDB API and checking the response, not assumed."""
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(200, json=[_rich_payload(igdb_id=seed_game.igdb_id)]),
            httpx.Response(200, json=[]),
        ]
    )

    response = auth_client.post(f"/api/games/{seed_game.id}/resync")

    assert response.status_code == 200
    body = response.json()
    assert [g["name"] for g in body["genres"]] == ["RPG"]
    assert len(body["companies"]) == 2
    assert body["screenshotUrls"] != []


@respx.mock
def test_resync_replaces_genres_wholesale_not_additively(auth_client, db_session, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(200, json=[_rich_payload(genre_count=2)]),
            httpx.Response(200, json=[]),
            httpx.Response(200, json=[_rich_payload(genre_count=1)]),
            httpx.Response(200, json=[]),
        ]
    )

    first = auth_client.post("/api/games", json={"igdbId": 3212})
    assert len(first.json()["genres"]) == 2

    second = auth_client.post("/api/games", json={"igdbId": 3212})
    assert [g["name"] for g in second.json()["genres"]] == ["RPG"]

    game_id = second.json()["id"]
    assert db_session.query(GameGenre).filter_by(game_id=game_id).count() == 1
    # Only one Genre row for "RPG" exists locally - get-or-create by igdb_id, not a fresh
    # row every resync.
    assert db_session.query(Genre).filter_by(igdb_id=12).count() == 1


@respx.mock
def test_delete_game_cleans_up_catalog_richness_tables(auth_client, db_session, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(200, json=[_rich_payload()]),
            httpx.Response(200, json=[]),
        ]
    )
    game_id = auth_client.post("/api/games", json={"igdbId": 3212}).json()["id"]

    response = auth_client.delete(f"/api/games/{game_id}")

    assert response.status_code == 204
    assert db_session.query(GameGenre).filter_by(game_id=game_id).count() == 0
    assert db_session.query(GameCompany).filter_by(game_id=game_id).count() == 0
    assert db_session.query(GameFranchise).filter_by(game_id=game_id).count() == 0
    assert db_session.query(GameCollection).filter_by(game_id=game_id).count() == 0
    assert db_session.query(GamePlatform).filter_by(game_id=game_id).count() == 0
    assert db_session.query(Screenshot).filter_by(game_id=game_id).count() == 0
    assert db_session.query(Artwork).filter_by(game_id=game_id).count() == 0
    assert db_session.query(GameVideo).filter_by(game_id=game_id).count() == 0
    assert db_session.query(ReleaseDate).filter_by(game_id=game_id).count() == 0
    # The shared lookup rows (Genre/Company/Franchise/Collection/Platform) are NOT deleted —
    # only this game's links to them, since other games may still reference them.
    assert db_session.query(Genre).filter_by(igdb_id=12).count() == 1
    assert db_session.query(Company).filter_by(igdb_id=1).count() == 1
    assert db_session.query(Franchise).filter_by(igdb_id=979).count() == 1
    assert db_session.query(Collection).filter_by(igdb_id=61).count() == 1
    assert db_session.query(Platform).filter_by(igdb_id=48).count() == 1


@respx.mock
def test_import_persists_two_release_dates_sharing_a_platform_and_region(auth_client, db_session, igdb_client):
    """Regression test: the original release_dates model had a UniqueConstraint on
    (game_id, platform_id, release_region), assuming a game has at most one release date
    per platform+region. A real resync of "Age of Empires II: Definitive Edition" against
    the live IGDB API proved that assumption wrong — IGDB can return two release_dates
    entries with the same platform and region (e.g. a later re-release date for the same
    platform/region under a different IGDB id), which crashed the resync with a SQLite
    UNIQUE constraint IntegrityError. igdb_id (already unique) is the only real natural key
    here; the constraint was dropped in migration e1dc0a572a1b."""
    payload = _rich_payload()
    payload["release_dates"] = [
        {
            "id": 20206,
            "date": 1409616000,
            "human": "Sep 02, 2014",
            "release_region": 2,
            "platform": {"id": 48, "name": "PlayStation 4"},
        },
        {
            "id": 20207,
            "date": 1746489600,
            "human": "May 06, 2025",
            "release_region": 2,
            "platform": {"id": 48, "name": "PlayStation 4"},
        },
    ]
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(200, json=[payload]),
            httpx.Response(200, json=[]),
        ]
    )

    response = auth_client.post("/api/games", json={"igdbId": 3212})

    assert response.status_code == 201
    assert len(response.json()["releaseDates"]) == 2


def test_release_date_region_enum_maps_correctly():
    assert IgdbReleaseRegion.from_igdb_value(1) == IgdbReleaseRegion.EUROPE
    assert IgdbReleaseRegion.from_igdb_value(2) == IgdbReleaseRegion.NORTH_AMERICA
    assert IgdbReleaseRegion.from_igdb_value(8) == IgdbReleaseRegion.WORLDWIDE
    assert IgdbReleaseRegion.from_igdb_value(None) is None
    assert IgdbReleaseRegion.from_igdb_value(99) is None
