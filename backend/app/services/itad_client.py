from dataclasses import dataclass
from datetime import datetime

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings

ITAD_API_BASE = "https://api.isthereanydeal.com"

# Same reasoning as igdb_client.py's/steam_client.py's _retryable: transient network/5xx
# failures are worth retrying, a 4xx (bad key, malformed request) never gets better on retry.
_retryable = retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)


class ItadCredentialsError(Exception):
    """Raised when ITAD_API_KEY isn't configured."""


@dataclass
class ItadDeal:
    shop_name: str
    price_amount: float
    price_currency: str
    cut: int


@dataclass
class ItadHistoricalLow:
    shop_name: str | None
    price_amount: float | None
    price_currency: str | None
    cut: int | None
    achieved_at: datetime | None


class ItadClient:
    def __init__(self, api_key: str | None = None, http_client: httpx.AsyncClient | None = None) -> None:
        settings = get_settings()
        self._api_key = api_key or settings.itad_api_key
        self._http = http_client or httpx.AsyncClient(timeout=10.0)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "ItadClient":
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    @_retryable
    async def _request(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        response = await self._http.request(method, url, **kwargs)
        response.raise_for_status()
        return response

    def _require_key(self) -> str:
        if not self._api_key:
            raise ItadCredentialsError("ITAD_API_KEY is not configured")
        return self._api_key

    async def lookup_game_id(self, title: str) -> str | None:
        """Title -> ITAD's internal game id, or None if ITAD has no match at all (e.g. a
        retro/physical-only title with no digital release)."""
        key = self._require_key()
        response = await self._request(
            "GET", f"{ITAD_API_BASE}/games/lookup/v1", params={"key": key, "title": title}
        )
        data = response.json()
        if not data.get("found"):
            return None
        return data["game"]["id"]

    async def get_prices(self, itad_ids: list[str], country: str) -> dict[str, list[ItadDeal]]:
        """Batched — one request for every id, not one call per game. Returns every shop's
        current deal for each id (an empty list = nothing on sale right now, not an error) —
        not just the cheapest, since a wishlist row is only buyable through the one shop its
        own digital_storefront names and callers need to match against that specific shop
        (see storefront_matching.py) rather than assume the globally cheapest shop is the one
        the user meant."""
        if not itad_ids:
            return {}
        key = self._require_key()
        response = await self._request(
            "POST", f"{ITAD_API_BASE}/games/prices/v3", params={"key": key, "country": country}, json=itad_ids
        )
        result: dict[str, list[ItadDeal]] = {}
        for entry in response.json():
            result[entry["id"]] = [
                ItadDeal(
                    shop_name=deal["shop"]["name"],
                    price_amount=deal["price"]["amount"],
                    price_currency=deal["price"]["currency"],
                    cut=deal.get("cut", 0),
                )
                for deal in (entry.get("deals") or [])
            ]
        return result

    async def get_historical_low(self, itad_ids: list[str], country: str) -> dict[str, ItadHistoricalLow | None]:
        """Batched, same shape as get_prices."""
        if not itad_ids:
            return {}
        key = self._require_key()
        response = await self._request(
            "POST", f"{ITAD_API_BASE}/games/historylow/v1", params={"key": key, "country": country}, json=itad_ids
        )
        result: dict[str, ItadHistoricalLow | None] = {}
        for entry in response.json():
            low = entry.get("low")
            if not low:
                result[entry["id"]] = None
                continue
            price = low.get("price") or {}
            shop = low.get("shop") or {}
            result[entry["id"]] = ItadHistoricalLow(
                shop_name=shop.get("name"),
                price_amount=price.get("amount"),
                price_currency=price.get("currency"),
                cut=low.get("cut"),
                achieved_at=datetime.fromisoformat(low["timestamp"]) if low.get("timestamp") else None,
            )
        return result
