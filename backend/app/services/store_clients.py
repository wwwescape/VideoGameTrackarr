import asyncio
import json
import urllib.parse
from dataclasses import dataclass

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

# Same reasoning as igdb_client.py's _retryable.
_retryable = retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)


class StoreLoginError(Exception):
    """The store refused the code or the saved refresh token: sign in again."""


@dataclass(frozen=True)
class StoreGame:
    # The store's own id for it: Epic's catalog item id, GOG's product id.
    id: str
    title: str


@dataclass(frozen=True)
class StoreSession:
    refresh_token: str
    access_token: str


def code_from_paste(value: str, key: str) -> str:
    """What the user pasted after signing in: the code itself, the page's whole JSON, or the
    URL it ended on — whichever they copied."""
    value = value.strip()
    if value.startswith("http"):
        return urllib.parse.parse_qs(urllib.parse.urlparse(value).query).get("code", [value])[0]
    if value.startswith("{") and f'"{key}"' in value:
        return json.loads(value).get(key) or value
    return value


class EpicClient:
    """The Epic Games Store library, read the way the Epic launcher (and Legendary, the open
    source launcher this follows) does: signing in on epicgames.com gives an authorization
    code, exchanged once for a refresh token that's renewed on every sync."""

    # The Epic launcher's public client — what Legendary and other open launchers use too.
    _CLIENT_ID = "34a02cf8f4414e29b15921876da36f9a"
    _CLIENT_SECRET = "daafbccc737745039dffe53d94fc76cf"
    _OAUTH_URL = "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token"
    _LIBRARY_URL = "https://library-service.live.use1a.on.epicgames.com/library/api/public/items"
    _CATALOG_URL = "https://catalog-public-service-prod06.ol.epicgames.com/catalog/api/shared/namespace/{namespace}/bulk/items"
    _USER_AGENT = "UELauncher/11.0.1-14907503+++Portal+Release-Live Windows/10.0.19041.1.256.64bit"
    LOGIN_URL = (
        "https://www.epicgames.com/id/login?redirectUrl="
        + urllib.parse.quote(f"https://www.epicgames.com/id/api/redirect?clientId={_CLIENT_ID}&responseType=code")
    )

    def __init__(self, http_client: httpx.AsyncClient | None = None) -> None:
        self._http = http_client or httpx.AsyncClient(timeout=30.0, headers={"User-Agent": self._USER_AGENT})

    async def aclose(self) -> None:
        await self._http.aclose()

    async def start_session(self, *, code: str | None = None, refresh_token: str | None = None) -> StoreSession:
        data = (
            {"grant_type": "authorization_code", "code": code, "token_type": "eg1"}
            if code
            else {"grant_type": "refresh_token", "refresh_token": refresh_token, "token_type": "eg1"}
        )
        response = await self._http.post(self._OAUTH_URL, data=data, auth=(self._CLIENT_ID, self._CLIENT_SECRET))
        if response.status_code >= 500:
            response.raise_for_status()
        payload = response.json()
        if response.status_code >= 400 or "access_token" not in payload:
            raise StoreLoginError(payload.get("errorCode", "Epic refused the sign-in"))
        return StoreSession(refresh_token=payload["refresh_token"], access_token=payload["access_token"])

    @_retryable
    async def _get(self, url: str, access_token: str, params: dict) -> dict:
        response = await self._http.get(url, params=params, headers={"Authorization": f"bearer {access_token}"})
        response.raise_for_status()
        return response.json()

    async def owned_games(self, access_token: str) -> list[StoreGame]:
        """Every game in the account — DLC and other add-ons (items with a main game) and
        anything not in the catalog's games category are left out."""
        records: list[dict] = []
        cursor = None
        while True:
            params = {"includeMetadata": "true", **({"cursor": cursor} if cursor else {})}
            page = await self._get(self._LIBRARY_URL, access_token, params)
            records += page.get("records", [])
            cursor = (page.get("responseMetadata") or {}).get("nextCursor")
            if not cursor:
                break
        by_namespace: dict[str, list[str]] = {}
        for record in records:
            if record.get("namespace") and record.get("catalogItemId"):
                by_namespace.setdefault(record["namespace"], []).append(record["catalogItemId"])
        games: list[StoreGame] = []
        for namespace, item_ids in by_namespace.items():
            await asyncio.sleep(0.2)
            items = await self._get(
                self._CATALOG_URL.format(namespace=namespace),
                access_token,
                {"id": item_ids, "includeMainGameDetails": "true", "country": "US", "locale": "en"},
            )
            for item_id, item in items.items():
                categories = {category.get("path") for category in item.get("categories") or []}
                if "games" in categories and not item.get("mainGameItem"):
                    games.append(StoreGame(id=item_id, title=item.get("title") or item_id))
        return games


class GogClient:
    """The GOG library, through GOG Galaxy's sign-in: the page ends on a URL carrying a code,
    exchanged once for a refresh token that's renewed on every sync."""

    # GOG Galaxy's public client, the one its open-source integrations use.
    _CLIENT_ID = "46899977096215655"
    _CLIENT_SECRET = "9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9"
    _REDIRECT_URI = "https://embed.gog.com/on_login_success?origin=client"
    _TOKEN_URL = "https://auth.gog.com/token"
    _PRODUCTS_URL = "https://embed.gog.com/account/getFilteredProducts"
    LOGIN_URL = "https://auth.gog.com/auth?" + urllib.parse.urlencode(
        {"client_id": _CLIENT_ID, "redirect_uri": _REDIRECT_URI, "response_type": "code", "layout": "client2"}
    )

    def __init__(self, http_client: httpx.AsyncClient | None = None) -> None:
        self._http = http_client or httpx.AsyncClient(timeout=30.0)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def start_session(self, *, code: str | None = None, refresh_token: str | None = None) -> StoreSession:
        grant = (
            {"grant_type": "authorization_code", "code": code, "redirect_uri": self._REDIRECT_URI}
            if code
            else {"grant_type": "refresh_token", "refresh_token": refresh_token}
        )
        response = await self._http.get(
            self._TOKEN_URL, params={"client_id": self._CLIENT_ID, "client_secret": self._CLIENT_SECRET, **grant}
        )
        if response.status_code >= 500:
            response.raise_for_status()
        payload = response.json()
        if response.status_code >= 400 or "access_token" not in payload:
            raise StoreLoginError(payload.get("error_description") or "GOG refused the sign-in")
        return StoreSession(refresh_token=payload["refresh_token"], access_token=payload["access_token"])

    @_retryable
    async def _page(self, access_token: str, page: int) -> dict:
        response = await self._http.get(
            self._PRODUCTS_URL,
            params={"mediaType": 1, "page": page},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        response.raise_for_status()
        return response.json()

    async def owned_games(self, access_token: str) -> list[StoreGame]:
        games: list[StoreGame] = []
        page, pages = 1, 1
        while page <= pages:
            data = await self._page(access_token, page)
            pages = data.get("totalPages", 1)
            games += [StoreGame(id=str(product["id"]), title=product["title"]) for product in data.get("products", [])]
            page += 1
        return games
