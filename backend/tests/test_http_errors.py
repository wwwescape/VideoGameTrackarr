import httpx
import pytest

from app.services.http_errors import raise_for_status_redacted
from app.services.itad_client import ItadClient
from app.services.steam_client import SteamClient


def _response(status: int, url: str) -> httpx.Response:
    return httpx.Response(status, request=httpx.Request("GET", url))


def test_redacted_error_names_host_and_path_but_not_the_query():
    response = _response(403, "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1?key=SECRET&steamid=1")

    with pytest.raises(httpx.HTTPStatusError) as info:
        raise_for_status_redacted(response)

    assert "SECRET" not in str(info.value)
    assert "api.steampowered.com/IPlayerService/GetOwnedGames/v1" in str(info.value)
    assert "403" in str(info.value)
    assert info.value.response.status_code == 403


def test_success_passes_through():
    raise_for_status_redacted(_response(200, "https://example.com/x?key=SECRET"))


@pytest.mark.asyncio
async def test_steam_client_errors_do_not_carry_the_api_key():
    transport = httpx.MockTransport(lambda request: httpx.Response(403))
    client = SteamClient(api_key="SECRET-STEAM-KEY", http_client=httpx.AsyncClient(transport=transport))

    with pytest.raises(httpx.HTTPStatusError) as info:
        await client.get_wishlist("76561198000000000")

    assert "SECRET-STEAM-KEY" not in str(info.value)


@pytest.mark.asyncio
async def test_itad_client_errors_do_not_carry_the_api_key():
    transport = httpx.MockTransport(lambda request: httpx.Response(403))
    client = ItadClient(api_key="SECRET-ITAD-KEY", http_client=httpx.AsyncClient(transport=transport))

    with pytest.raises(httpx.HTTPStatusError) as info:
        await client.lookup_game_id("Celeste")

    assert "SECRET-ITAD-KEY" not in str(info.value)
