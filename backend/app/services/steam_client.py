from dataclasses import dataclass
from datetime import UTC, datetime

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings

STEAM_API_BASE = "https://api.steampowered.com"

# Same reasoning as igdb_client.py's _retryable: transient network/5xx failures are worth
# retrying, a 4xx (bad key, malformed request) never gets better on retry.
_retryable = retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)


class SteamCredentialsError(Exception):
    """Raised when STEAM_API_KEY isn't configured."""


@dataclass
class SteamOwnedGame:
    app_id: int
    name: str
    playtime_minutes: int
    last_played_at: datetime | None


@dataclass
class SteamWishlistItem:
    app_id: int
    added_at: datetime | None


class SteamClient:
    def __init__(self, api_key: str | None = None, http_client: httpx.AsyncClient | None = None) -> None:
        settings = get_settings()
        self._api_key = api_key or settings.steam_api_key
        self._http = http_client or httpx.AsyncClient(timeout=10.0)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "SteamClient":
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    @_retryable
    async def _request(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        response = await self._http.request(method, url, **kwargs)
        response.raise_for_status()
        return response

    async def get_owned_games(self, steam_id_64: str) -> list[SteamOwnedGame] | None:
        """None (not an empty list) signals a private/friends-only profile — Steam's
        response omits the "games" key entirely rather than returning an error, and that's
        meaningfully different from "this account owns 0 games"."""
        if not self._api_key:
            raise SteamCredentialsError("STEAM_API_KEY is not configured")

        response = await self._request(
            "GET",
            f"{STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/",
            params={
                "key": self._api_key,
                "steamid": steam_id_64,
                "format": "json",
                "include_appinfo": "true",
                "include_played_free_games": "true",
            },
        )
        payload = response.json().get("response", {})
        if "games" not in payload:
            return None

        return [
            SteamOwnedGame(
                app_id=game["appid"],
                name=game.get("name", f"Steam App {game['appid']}"),
                playtime_minutes=game.get("playtime_forever", 0),
                last_played_at=(
                    datetime.fromtimestamp(game["rtime_last_played"], tz=UTC)
                    if game.get("rtime_last_played")
                    else None
                ),
            )
            for game in payload["games"]
        ]

    async def get_wishlist(self, steam_id_64: str) -> list[SteamWishlistItem]:
        """Unlike get_owned_games, there's no reliable way to tell "wishlist is private" apart
        from "wishlist is genuinely empty" here — confirmed live against several public
        profiles during scoping, all returning the same bare `{"response": {}}` regardless of
        which applied. So this always returns a plain list (never None): a missing/empty
        `items` key is just treated as zero wishlisted items, not an error. Also unlike
        GetOwnedGames, this endpoint never returns a name — only appid/priority/date_added
        (confirmed against Steam's own Web API docs) — so the caller is responsible for
        resolving a display name (IGDB match, or a placeholder)."""
        if not self._api_key:
            raise SteamCredentialsError("STEAM_API_KEY is not configured")

        response = await self._request(
            "GET",
            f"{STEAM_API_BASE}/IWishlistService/GetWishlist/v1/",
            params={"key": self._api_key, "steamid": steam_id_64},
        )
        items = response.json().get("response", {}).get("items", [])

        return [
            SteamWishlistItem(
                app_id=item["appid"],
                added_at=(
                    datetime.fromtimestamp(item["date_added"], tz=UTC) if item.get("date_added") else None
                ),
            )
            for item in items
        ]
