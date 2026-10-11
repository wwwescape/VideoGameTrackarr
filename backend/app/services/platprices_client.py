from dataclasses import dataclass

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings

PLATPRICES_API_BASE = "https://platprices.com/api/v2"

# Same reasoning as itad_client.py's/steam_client.py's _retryable: transient network/5xx
# failures are worth retrying, a 4xx (bad key, malformed request) never gets better on retry.
_retryable = retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)


class PlatPricesCredentialsError(Exception):
    """Raised when PLATPRICES_API_KEY isn't configured."""


class PlatPricesRegionError(Exception):
    """Base for every "these prices aren't for PLATPRICES_REGION" failure. The refresh job
    clears cached prices on any of them, so a wrong region's prices never stay on screen."""


class PlatPricesRegionNotInPlanError(PlatPricesRegionError):
    """Raised when PLATPRICES_REGION isn't one of the (up to 2, on the free tier) regions
    this key's account is currently tracking — configurable on the PlatPrices dashboard,
    not something VGT can set on the account's behalf (see .env.example)."""


class PlatPricesInvalidRegionError(PlatPricesRegionError):
    """Raised when PlatPrices doesn't recognise PLATPRICES_REGION at all (400 INVALID_REGION),
    e.g. a typo or a country without a PlayStation Store."""


class PlatPricesRegionMismatchError(PlatPricesRegionError):
    """Raised when PlatPrices answers for a different region than the one asked for (its
    meta.region), instead of trusting those prices as PLATPRICES_REGION's."""


def _region_param(region: str) -> str:
    return region.strip().lower()


# PlatPrices' PriceCurrency is often null (it is for India, checked live 2026-10-11), and its
# /regions endpoint only gives a display symbol, not an ISO code. This is each PS Store
# region's currency, used whenever PriceCurrency is missing. Argentina and Chile really are
# priced in US dollars (/regions shows "US$" for both).
REGION_CURRENCIES = {
    "AE": "AED", "AR": "USD", "AT": "EUR", "AU": "AUD", "BE": "EUR", "BG": "EUR", "BR": "BRL",
    "CA": "CAD", "CH": "CHF", "CL": "USD", "CZ": "CZK", "DE": "EUR", "DK": "DKK", "ES": "EUR",
    "FI": "EUR", "FR": "EUR", "GB": "GBP", "GR": "EUR", "HK": "HKD", "HR": "EUR", "HU": "HUF",
    "ID": "IDR", "IE": "EUR", "IL": "ILS", "IN": "INR", "IS": "EUR", "IT": "EUR", "JP": "JPY",
    "KR": "KRW", "MX": "MXN", "MY": "MYR", "NL": "EUR", "NO": "NOK", "NZ": "NZD", "PL": "PLN",
    "PT": "EUR", "RO": "RON", "SA": "SAR", "SE": "SEK", "SG": "SGD", "SK": "EUR", "TH": "THB",
    "TR": "TRY", "TW": "TWD", "UA": "UAH", "US": "USD", "ZA": "ZAR",
}  # fmt: skip

# Prices are integers in each region's minor units, scaled by that region's decimalPlaces
# (PlatPrices' docs: "don't divide by 100 blindly"). Read live from /regions each run; this
# is the fallback if that call fails — the regions /regions listed with 0 places on 2026-10-11.
ZERO_DECIMAL_REGIONS = frozenset({"HU", "ID", "IN", "JP", "KR", "TW"})


def _currency_for(entry: dict, region: str) -> str:
    return entry.get("PriceCurrency") or REGION_CURRENCIES.get(region.strip().upper(), "USD")


@dataclass
class PlatPricesDeal:
    shop_name: str
    price_amount: float
    price_currency: str
    cut: int


@dataclass
class PlatPricesHistoricalLow:
    shop_name: str | None
    price_amount: float | None
    price_currency: str | None


@dataclass
class PlatPricesGameData:
    current_deal: PlatPricesDeal | None
    historical_low: PlatPricesHistoricalLow | None


def _parse_cut(raw: object) -> int:
    if raw in (None, ""):
        return 0
    return int(float(str(raw).rstrip("%")))


class PlatPricesClient:
    def __init__(self, api_key: str | None = None, http_client: httpx.AsyncClient | None = None) -> None:
        settings = get_settings()
        self._api_key = api_key or settings.platprices_api_key
        self._http = http_client or httpx.AsyncClient(timeout=10.0)
        self._decimal_places: dict[str, int] | None = None

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "PlatPricesClient":
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    def _require_key(self) -> str:
        if not self._api_key:
            raise PlatPricesCredentialsError("PLATPRICES_API_KEY is not configured")
        return self._api_key

    @_retryable
    async def _request(self, method: str, path: str, key: str, **kwargs: object) -> httpx.Response:
        response = await self._http.request(
            method, f"{PLATPRICES_API_BASE}{path}", headers={"X-API-Key": key}, **kwargs
        )
        if response.status_code in (400, 403):
            body = response.json()
            error = body.get("error") or {}
            if error.get("code") == "REGION_NOT_IN_PLAN":
                raise PlatPricesRegionNotInPlanError(
                    error.get("message") or "Region not enabled for this PlatPrices plan"
                )
            if error.get("code") == "INVALID_REGION":
                raise PlatPricesInvalidRegionError(error.get("message") or "PlatPrices doesn't recognise this region")
        response.raise_for_status()
        return response

    async def search_game(self, title: str, region: str) -> str | None:
        """Title -> PlatPrices' PPID, or None if no exact match. /games/search returns a
        ranked list of up to 200 fuzzy matches rather than one canonical id (unlike ITAD's
        lookup endpoint) — to avoid ever caching a wrong PPID, only an exact
        (case-insensitive) product-name match is accepted; anything else is treated as
        unmatched, same as a title ITAD itself can't find."""
        key = self._require_key()
        response = await self._request(
            "GET", "/games/search", key, params={"q": title, "region": _region_param(region)}
        )
        for candidate in response.json().get("data") or []:
            name = candidate.get("ProductName") or candidate.get("GameName") or ""
            if name.strip().lower() == title.strip().lower():
                return str(candidate["PPID"])
        return None

    async def get_decimal_places(self, region: str) -> int:
        """How many decimal places `region`'s prices carry (0 for India, Japan, …), from
        PlatPrices' /regions — free, doesn't count against the monthly quota, fetched once per
        client. Falls back to ZERO_DECIMAL_REGIONS if the call fails, so a /regions hiccup
        never fails a price refresh."""
        code = region.strip().upper()
        if self._decimal_places is None:
            try:
                response = await self._request("GET", "/regions", self._require_key())
                self._decimal_places = {
                    str(row["region"]).upper(): int(row["decimalPlaces"])
                    for row in response.json().get("data") or []
                    if row.get("region") and row.get("decimalPlaces") is not None
                }
            except Exception:  # noqa: BLE001 - fall back to the known list below
                self._decimal_places = {}
        if code in self._decimal_places:
            return self._decimal_places[code]
        return 0 if code in ZERO_DECIMAL_REGIONS else 2

    async def get_price_data(self, ppids: list[str], region: str) -> dict[str, PlatPricesGameData]:
        """Batched — one request for every id via /games/batch, not one call per game. Unlike
        ITAD (which needs two separate endpoint calls for current price vs. historical low),
        PlatPrices' single batch response already carries both (SalePrice/DiscPerc and
        LowestEverPrice on the same game object), so this is the only price-refresh call the
        job needs to make per run."""
        if not ppids:
            return {}
        key = self._require_key()
        response = await self._request(
            "GET", "/games/batch", key, params={"ppids": ",".join(ppids), "region": _region_param(region)}
        )
        body = response.json()
        answered_region = (body.get("meta") or {}).get("region")
        if answered_region and answered_region.strip().lower() != _region_param(region):
            raise PlatPricesRegionMismatchError(
                f"Asked PlatPrices for region {region.upper()} but it answered for {answered_region.upper()}"
            )
        scale = 10 ** await self.get_decimal_places(region)
        result: dict[str, PlatPricesGameData] = {}
        for entry in body.get("data") or []:
            ppid = str(entry["PPID"])
            currency = _currency_for(entry, region)

            current_deal = None
            if entry.get("IsOnSale") and entry.get("SalePrice") is not None:
                current_deal = PlatPricesDeal(
                    shop_name="PlayStation Store",
                    price_amount=entry["SalePrice"] / scale,
                    price_currency=currency,
                    cut=_parse_cut(entry.get("DiscPerc")),
                )

            historical_low = None
            if entry.get("LowestEverPrice") is not None:
                historical_low = PlatPricesHistoricalLow(
                    shop_name="PlayStation Store",
                    price_amount=entry["LowestEverPrice"] / scale,
                    price_currency=currency,
                )

            result[ppid] = PlatPricesGameData(current_deal=current_deal, historical_low=historical_low)
        return result
