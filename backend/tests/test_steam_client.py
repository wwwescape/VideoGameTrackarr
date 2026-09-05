import httpx
import pytest
import respx

from app.core.config import get_settings
from app.services.steam_client import STEAM_API_BASE, SteamClient, SteamCredentialsError


def make_client(**overrides) -> SteamClient:
    kwargs = {"api_key": "test-steam-key"}
    kwargs.update(overrides)
    return SteamClient(**kwargs)


async def test_get_owned_games_requires_an_api_key(monkeypatch):
    # The repo-root .env may have a real STEAM_API_KEY for local dev use, which the
    # constructor's `api_key or settings.steam_api_key` fallback would pick up instead of
    # None — override it explicitly, same reasoning as test_igdb_client.py's equivalent
    # credentials test.
    monkeypatch.setattr(get_settings(), "steam_api_key", None)
    client = make_client(api_key=None)

    with pytest.raises(SteamCredentialsError):
        await client.get_owned_games("76561197960287930")


@respx.mock
async def test_get_owned_games_parses_playtime_and_last_played():
    respx.get(f"{STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/").mock(
        return_value=httpx.Response(
            200,
            json={
                "response": {
                    "game_count": 1,
                    "games": [
                        {
                            "appid": 220,
                            "name": "Half-Life 2",
                            "playtime_forever": 754,
                            "rtime_last_played": 1690000000,
                        }
                    ],
                }
            },
        )
    )

    games = await make_client().get_owned_games("76561197960287930")

    assert len(games) == 1
    assert games[0].app_id == 220
    assert games[0].name == "Half-Life 2"
    assert games[0].playtime_minutes == 754
    assert games[0].last_played_at is not None


@respx.mock
async def test_get_owned_games_returns_none_for_a_private_profile():
    # Steam's actual signal for a private/friends-only profile: the response has no
    # "games" key at all, not an empty list and not an error.
    respx.get(f"{STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/").mock(
        return_value=httpx.Response(200, json={"response": {}})
    )

    result = await make_client().get_owned_games("76561197960287930")

    assert result is None


@respx.mock
async def test_get_owned_games_handles_a_genuinely_empty_library():
    respx.get(f"{STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/").mock(
        return_value=httpx.Response(200, json={"response": {"game_count": 0, "games": []}})
    )

    result = await make_client().get_owned_games("76561197960287930")

    assert result == []


async def test_get_wishlist_requires_an_api_key(monkeypatch):
    monkeypatch.setattr(get_settings(), "steam_api_key", None)
    client = make_client(api_key=None)

    with pytest.raises(SteamCredentialsError):
        await client.get_wishlist("76561197960287930")


@respx.mock
async def test_get_wishlist_parses_appid_and_date_added():
    respx.get(f"{STEAM_API_BASE}/IWishlistService/GetWishlist/v1/").mock(
        return_value=httpx.Response(
            200, json={"response": {"items": [{"appid": 220, "priority": 1, "date_added": 1690000000}]}}
        )
    )

    items = await make_client().get_wishlist("76561197960287930")

    assert len(items) == 1
    assert items[0].app_id == 220
    assert items[0].added_at is not None


@respx.mock
async def test_get_wishlist_handles_an_empty_response():
    # Confirmed live against the real API: a private wishlist and a genuinely empty one both
    # return a bare `{"response": {}}` with no way to tell them apart — always a plain empty
    # list here, never an error (see SteamClient.get_wishlist's docstring).
    respx.get(f"{STEAM_API_BASE}/IWishlistService/GetWishlist/v1/").mock(
        return_value=httpx.Response(200, json={"response": {}})
    )

    result = await make_client().get_wishlist("76561197960287930")

    assert result == []
