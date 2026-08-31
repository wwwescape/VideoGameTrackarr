from dataclasses import dataclass

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

STEAM_STORE_API_BASE = "https://store.steampowered.com/api"

# Undocumented Steam CDN convention for a portrait "library cover" (600x900) — matches
# IGDB's cover aspect ratio much better than the officially-documented header_image (a
# horizontal banner). Confirmed working for a real AppID during scoping, but Valve doesn't
# document or guarantee this path, and not every game has one generated — always probed
# with a HEAD request and falls back to header_image, never assumed.
_LIBRARY_COVER_URL = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{app_id}/library_600x900.jpg"

# Same reasoning as igdb_client.py's _retryable: transient network/5xx failures are worth
# retrying, a 4xx never gets better on retry.
_retryable = retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)


@dataclass
class SteamStoreDetails:
    name: str
    summary: str | None
    cover_url: str | None


class SteamStoreClient:
    """A separate client from SteamClient (IPlayerService) — this talks to Steam's public,
    unauthenticated Store API instead, a different base URL and response shape with no key
    involved at all. Used lazily, on-demand only (when a user clicks "Add as custom game"
    for an unmatched entry), never during Import — this API has informal, undocumented rate
    limits and there's no reason to hit it for entries nobody asks about."""

    def __init__(self, http_client: httpx.AsyncClient | None = None) -> None:
        self._http = http_client or httpx.AsyncClient(timeout=10.0)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "SteamStoreClient":
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    @_retryable
    async def _request(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        response = await self._http.request(method, url, **kwargs)
        response.raise_for_status()
        return response

    async def get_app_details(self, app_id: int) -> SteamStoreDetails | None:
        response = await self._request(
            "GET", f"{STEAM_STORE_API_BASE}/appdetails", params={"appids": app_id, "cc": "us", "l": "en"}
        )
        payload = response.json().get(str(app_id))
        if not payload or not payload.get("success"):
            return None

        app = payload["data"]
        return SteamStoreDetails(
            name=app.get("name", f"Steam App {app_id}"),
            summary=app.get("short_description") or None,
            cover_url=await self._resolve_cover_url(app_id, app.get("header_image")),
        )

    async def _resolve_cover_url(self, app_id: int, fallback: str | None) -> str | None:
        portrait_url = _LIBRARY_COVER_URL.format(app_id=app_id)
        try:
            head_response = await self._http.head(portrait_url)
            if head_response.status_code == 200:
                return portrait_url
        except httpx.HTTPError:
            pass
        return fallback
