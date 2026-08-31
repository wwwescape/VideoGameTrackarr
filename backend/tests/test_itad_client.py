import httpx
import pytest
import respx

from app.core.config import get_settings
from app.services.itad_client import ITAD_API_BASE, ItadClient, ItadCredentialsError


def make_client(**overrides) -> ItadClient:
    kwargs = {"api_key": "test-itad-key"}
    kwargs.update(overrides)
    return ItadClient(**kwargs)


async def test_lookup_game_id_requires_an_api_key(monkeypatch):
    # The repo-root .env may have a real ITAD_API_KEY for local dev use, which the
    # constructor's `api_key or settings.itad_api_key` fallback would pick up instead of
    # None — override it explicitly, same reasoning as test_igdb_client.py's/
    # test_steam_client.py's equivalent credentials tests.
    monkeypatch.setattr(get_settings(), "itad_api_key", None)
    client = make_client(api_key=None)

    with pytest.raises(ItadCredentialsError):
        await client.lookup_game_id("Half-Life 2")


@respx.mock
async def test_lookup_game_id_returns_the_matched_id():
    respx.get(f"{ITAD_API_BASE}/games/lookup/v1").mock(
        return_value=httpx.Response(
            200, json={"found": True, "game": {"id": "018d937f-eb6a-70c1-9b1a-2b2c2b2c2b2c", "title": "Half-Life 2"}}
        )
    )

    itad_id = await make_client().lookup_game_id("Half-Life 2")

    assert itad_id == "018d937f-eb6a-70c1-9b1a-2b2c2b2c2b2c"


@respx.mock
async def test_lookup_game_id_returns_none_when_not_found():
    respx.get(f"{ITAD_API_BASE}/games/lookup/v1").mock(return_value=httpx.Response(200, json={"found": False}))

    itad_id = await make_client().lookup_game_id("Some Obscure Retro Title")

    assert itad_id is None


@respx.mock
async def test_get_prices_picks_the_cheapest_deal():
    respx.post(f"{ITAD_API_BASE}/games/prices/v3").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "id": "game-1",
                    "deals": [
                        {"shop": {"name": "Steam"}, "price": {"amount": 19.99, "currency": "USD"}, "cut": 20},
                        {"shop": {"name": "GOG"}, "price": {"amount": 14.99, "currency": "USD"}, "cut": 40},
                    ],
                }
            ],
        )
    )

    prices = await make_client().get_prices(["game-1"], "US")

    assert prices["game-1"].shop_name == "GOG"
    assert prices["game-1"].price_amount == 14.99
    assert prices["game-1"].cut == 40


@respx.mock
async def test_get_prices_is_none_when_no_deals():
    respx.post(f"{ITAD_API_BASE}/games/prices/v3").mock(
        return_value=httpx.Response(200, json=[{"id": "game-1", "deals": []}])
    )

    prices = await make_client().get_prices(["game-1"], "US")

    assert prices["game-1"] is None


async def test_get_prices_returns_empty_for_no_ids():
    prices = await make_client().get_prices([], "US")

    assert prices == {}


@respx.mock
async def test_get_historical_low_returns_mapped_fields():
    respx.post(f"{ITAD_API_BASE}/games/historylow/v1").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "id": "game-1",
                    "low": {
                        "shop": {"name": "Steam"},
                        "price": {"amount": 9.99, "currency": "USD"},
                        "cut": 75,
                        "timestamp": "2026-01-15T00:00:00+00:00",
                    },
                }
            ],
        )
    )

    historical = await make_client().get_historical_low(["game-1"], "US")

    assert historical["game-1"].shop_name == "Steam"
    assert historical["game-1"].price_amount == 9.99
    assert historical["game-1"].cut == 75
