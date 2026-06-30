import httpx
import pytest
import respx

from app.core.config import Settings
from app.services import igdb_client as igdb_client_module
from app.services.cache import InMemoryTTLCache
from app.services.igdb_client import IGDB_API_BASE, IGDB_TOKEN_URL, IGDBClient, IGDBCredentialsError

TOKEN_RESPONSE = httpx.Response(200, json={"access_token": "test-token", "expires_in": 3600})


def make_client(**overrides) -> IGDBClient:
    kwargs = {"client_id": "client-id", "client_secret": "client-secret", "cache": InMemoryTTLCache()}
    kwargs.update(overrides)
    return IGDBClient(**kwargs)


async def test_search_games_requires_credentials(monkeypatch):
    # IGDBClient falls back to settings.igdb_client_id/secret when constructor args are
    # None. The repo-root .env (real credentials) is read directly off disk by
    # pydantic-settings, so without this override the fallback would resolve to real
    # credentials instead of "none configured".
    monkeypatch.setattr(
        igdb_client_module,
        "get_settings",
        lambda: Settings(_env_file=None, igdb_client_id=None, igdb_client_secret=None),
    )
    client = make_client(client_id=None, client_secret=None)

    with pytest.raises(IGDBCredentialsError):
        await client.search_games("zelda")


@respx.mock
async def test_search_games_attaches_batched_covers():
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        return_value=httpx.Response(
            200,
            json=[
                {"id": 1, "name": "Game A", "cover": 100},
                {"id": 2, "name": "Game B", "cover": 200},
            ],
        )
    )
    covers_route = respx.post(f"{IGDB_API_BASE}/covers").mock(
        return_value=httpx.Response(
            200,
            json=[
                {"id": 100, "url": "//images.igdb.com/igdb/image/upload/t_thumb/a.jpg"},
                {"id": 200, "url": "//images.igdb.com/igdb/image/upload/t_thumb/b.jpg"},
            ],
        )
    )

    games = await make_client().search_games("zelda")

    assert covers_route.call_count == 1
    assert games[0]["cover_url"] == "https://images.igdb.com/igdb/image/upload/t_720p/a.jpg"
    assert games[1]["cover_url"] == "https://images.igdb.com/igdb/image/upload/t_720p/b.jpg"


@respx.mock
async def test_access_token_is_cached_across_calls():
    token_route = respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(return_value=httpx.Response(200, json=[]))

    client = make_client()
    await client.search_games("zelda")
    await client.search_games("mario")

    assert token_route.call_count == 1


@respx.mock
async def test_search_results_are_cached():
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    games_route = respx.post(f"{IGDB_API_BASE}/games").mock(
        return_value=httpx.Response(200, json=[{"id": 1, "name": "Game A"}])
    )

    client = make_client()
    await client.search_games("zelda")
    await client.search_games("zelda")

    assert games_route.call_count == 1


@respx.mock
async def test_cover_lookup_is_cached_per_id():
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(200, json=[{"id": 1, "name": "Game A", "cover": 100}]),
            httpx.Response(200, json=[{"id": 2, "name": "Game B", "cover": 100}]),
        ]
    )
    covers_route = respx.post(f"{IGDB_API_BASE}/covers").mock(
        return_value=httpx.Response(200, json=[{"id": 100, "url": "//images.igdb.com/t_thumb/a.jpg"}])
    )

    client = make_client()
    await client.search_games("zelda")
    await client.search_games("mario")  # different query -> not served from search cache

    assert covers_route.call_count == 1


@respx.mock
async def test_retries_transient_failure_then_succeeds():
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    games_route = respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[httpx.Response(500), httpx.Response(200, json=[])]
    )

    games = await make_client().search_games("zelda")

    assert games == []
    assert games_route.call_count == 2


@respx.mock
async def test_gives_up_after_max_attempts():
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    games_route = respx.post(f"{IGDB_API_BASE}/games").mock(return_value=httpx.Response(500))

    with pytest.raises(httpx.HTTPStatusError):
        await make_client().search_games("zelda")

    assert games_route.call_count == 3


@respx.mock
async def test_search_query_is_escaped_against_apicalypse_injection():
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    games_route = respx.post(f"{IGDB_API_BASE}/games").mock(return_value=httpx.Response(200, json=[]))

    await make_client().search_games('Game"; where category = 0;limit 9999;"')

    sent_body = games_route.calls.last.request.content.decode("utf-8")
    assert '\\"' in sent_body
    assert 'search "Game\\"; where category = 0;limit 9999;\\""' in sent_body


@respx.mock
async def test_search_games_filters_to_browsable_game_types():
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    games_route = respx.post(f"{IGDB_API_BASE}/games").mock(return_value=httpx.Response(200, json=[]))

    await make_client().search_games("zelda")

    sent_body = games_route.calls.last.request.content.decode("utf-8")
    assert "game_type = (0,3,4,8,9,10) | game_type = null" in sent_body
    # Used to exclude everything with a parent_game backlink — wrong, since a remaster/
    # bundle/standalone expansion/remake commonly has one and should still be searchable.
    assert "parent_game = null" not in sent_body


@respx.mock
async def test_get_addons_by_parent_igdb_id_filters_to_hierarchical_game_types():
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    games_route = respx.post(f"{IGDB_API_BASE}/games").mock(return_value=httpx.Response(200, json=[]))

    await make_client().get_addons_by_parent_igdb_id(42)

    sent_body = games_route.calls.last.request.content.decode("utf-8")
    assert "where parent_game = 42 & game_type = (1,2,13)" in sent_body


@respx.mock
async def test_get_games_by_ids_batches_in_one_request():
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    games_route = respx.post(f"{IGDB_API_BASE}/games").mock(
        return_value=httpx.Response(200, json=[{"id": 1, "name": "Game A"}, {"id": 2, "name": "Game B"}])
    )

    games = await make_client().get_games_by_ids([1, 2])

    assert games_route.call_count == 1
    assert {g["id"] for g in games} == {1, 2}
