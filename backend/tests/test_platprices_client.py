import httpx
import pytest
import respx

from app.core.config import get_settings
from app.services.platprices_client import (
    PLATPRICES_API_BASE,
    PlatPricesClient,
    PlatPricesCredentialsError,
    PlatPricesRegionNotInPlanError,
)


def make_client(**overrides) -> PlatPricesClient:
    kwargs = {"api_key": "test-platprices-key"}
    kwargs.update(overrides)
    return PlatPricesClient(**kwargs)


async def test_search_game_requires_an_api_key(monkeypatch):
    # The repo-root .env may have a real PLATPRICES_API_KEY for local dev use — override it
    # explicitly, same reasoning as test_itad_client.py's equivalent credentials test.
    monkeypatch.setattr(get_settings(), "platprices_api_key", None)
    client = make_client(api_key=None)

    with pytest.raises(PlatPricesCredentialsError):
        await client.search_game("Ghost of Tsushima", "US")


@respx.mock
async def test_search_game_returns_the_exact_match():
    respx.get(f"{PLATPRICES_API_BASE}/games/search").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": [
                    {"PPID": 111, "ProductName": "Ghost of Tsushima Director's Cut"},
                    {"PPID": 222, "ProductName": "Ghost of Tsushima"},
                ],
            },
        )
    )

    ppid = await make_client().search_game("Ghost of Tsushima", "US")

    assert ppid == "222"


@respx.mock
async def test_search_game_ignores_non_exact_matches():
    respx.get(f"{PLATPRICES_API_BASE}/games/search").mock(
        return_value=httpx.Response(
            200,
            json={"success": True, "data": [{"PPID": 111, "ProductName": "Ghost of Tsushima Director's Cut"}]},
        )
    )

    ppid = await make_client().search_game("Ghost of Tsushima", "US")

    assert ppid is None


@respx.mock
async def test_search_game_returns_none_when_no_results():
    respx.get(f"{PLATPRICES_API_BASE}/games/search").mock(
        return_value=httpx.Response(200, json={"success": True, "data": []})
    )

    ppid = await make_client().search_game("Some Obscure Title", "US")

    assert ppid is None


@respx.mock
async def test_get_price_data_maps_a_current_deal_and_historical_low():
    respx.get(f"{PLATPRICES_API_BASE}/games/batch").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": [
                    {
                        "PPID": 222,
                        "IsOnSale": 1,
                        "SalePrice": 1499,
                        "DiscPerc": "50",
                        "LowestEverPrice": 999,
                        "PriceCurrency": "USD",
                    }
                ],
            },
        )
    )

    result = await make_client().get_price_data(["222"], "US")

    deal = result["222"].current_deal
    assert deal.price_amount == 14.99
    assert deal.price_currency == "USD"
    assert deal.cut == 50
    assert deal.shop_name == "PlayStation Store"
    historical = result["222"].historical_low
    assert historical.price_amount == 9.99


@respx.mock
async def test_get_price_data_has_no_current_deal_when_not_on_sale():
    respx.get(f"{PLATPRICES_API_BASE}/games/batch").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": [
                    {
                        "PPID": 222,
                        "IsOnSale": 0,
                        "SalePrice": 5999,
                        "DiscPerc": "0",
                        "LowestEverPrice": 999,
                        "PriceCurrency": "USD",
                    }
                ],
            },
        )
    )

    result = await make_client().get_price_data(["222"], "US")

    assert result["222"].current_deal is None
    assert result["222"].historical_low.price_amount == 9.99


async def test_get_price_data_returns_empty_for_no_ids():
    result = await make_client().get_price_data([], "US")

    assert result == {}


@respx.mock
async def test_region_not_in_plan_raises_a_clear_error():
    respx.get(f"{PLATPRICES_API_BASE}/games/batch").mock(
        return_value=httpx.Response(
            403,
            json={
                "success": False,
                "data": None,
                "error": {"code": "REGION_NOT_IN_PLAN", "message": "Region not enabled for this key", "status": 403},
            },
        )
    )

    with pytest.raises(PlatPricesRegionNotInPlanError):
        await make_client().get_price_data(["222"], "IN")
