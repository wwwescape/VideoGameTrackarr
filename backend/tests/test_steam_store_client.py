import httpx
import respx

from app.services.steam_store_client import STEAM_STORE_API_BASE, SteamStoreClient

_PORTRAIT_COVER_URL = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/220/library_600x900.jpg"


@respx.mock
async def test_get_app_details_prefers_the_portrait_cover_when_it_exists():
    respx.get(f"{STEAM_STORE_API_BASE}/appdetails").mock(
        return_value=httpx.Response(
            200,
            json={
                "220": {
                    "success": True,
                    "data": {
                        "name": "Half-Life 2",
                        "short_description": "Reawakened from stasis...",
                        "header_image": "https://example.com/header.jpg",
                    },
                }
            },
        )
    )
    respx.head(_PORTRAIT_COVER_URL).mock(return_value=httpx.Response(200))

    details = await SteamStoreClient().get_app_details(220)

    assert details.name == "Half-Life 2"
    assert details.summary == "Reawakened from stasis..."
    assert details.cover_url == _PORTRAIT_COVER_URL


@respx.mock
async def test_get_app_details_falls_back_to_header_image_when_no_portrait_cover():
    respx.get(f"{STEAM_STORE_API_BASE}/appdetails").mock(
        return_value=httpx.Response(
            200,
            json={
                "220": {
                    "success": True,
                    "data": {
                        "name": "Half-Life 2",
                        "short_description": "Reawakened from stasis...",
                        "header_image": "https://example.com/header.jpg",
                    },
                }
            },
        )
    )
    respx.head(_PORTRAIT_COVER_URL).mock(return_value=httpx.Response(404))

    details = await SteamStoreClient().get_app_details(220)

    assert details.cover_url == "https://example.com/header.jpg"


@respx.mock
async def test_get_app_details_returns_none_when_steam_reports_failure():
    respx.get(f"{STEAM_STORE_API_BASE}/appdetails").mock(
        return_value=httpx.Response(200, json={"999999999": {"success": False}})
    )

    details = await SteamStoreClient().get_app_details(999999999)

    assert details is None
