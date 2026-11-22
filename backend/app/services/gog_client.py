import html
import re
import time
from dataclasses import dataclass, field

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.services.exceptions import ConflictError

GOG_AUTH_BASE = "https://auth.gog.com"
GOG_EMBED_BASE = "https://embed.gog.com"
GOG_API_BASE = "https://api.gog.com"
GOG_USERS_BASE = "https://users.gog.com"

# GOG has no public developer API or API keys for account data (owned games, installers),
# so this signs in the same way every third-party GOG client does (Heroic, Minigalaxy,
# lgogdownloader): with the GOG Galaxy client's own OAuth id and secret, which are public
# and have been stable for years. GOG only redirects that client back to its own
# on_login_success page, never to VGT, which is why the user pastes that page's address
# back into the Integrations page (see gog_service.connect). The user's own secret is the
# refresh token this returns, stored on the user row.
GOG_CLIENT_ID = "46899977096215655"
GOG_CLIENT_SECRET = "9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9"
GOG_REDIRECT_URI = "https://embed.gog.com/on_login_success?origin=client"

# Same reasoning as steam_client.py: transient network/5xx failures are worth retrying,
# a 4xx (bad code, revoked token) never gets better on retry.
_retryable = retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)

_TAG_RE = re.compile(r"<[^>]+>")
_SUMMARY_MAX_CHARS = 1000


class GogAuthError(Exception):
    """GOG rejected the login: a bad or expired code, or a revoked refresh token. The user
    connects GOG again on the Integrations page."""


class GogNotConnectedError(ConflictError):
    """No GOG account is connected yet. A 409, so the frontend shows its "connect GOG
    first" state instead of a generic error."""


@dataclass
class GogTokens:
    access_token: str
    refresh_token: str
    user_id: str
    expires_in: int


@dataclass
class GogOwnedGame:
    product_id: int
    name: str


@dataclass
class GogInstallerFile:
    id: str
    size: int
    # GOG's API link for this file. It still has to be resolved to the real, short-lived
    # CDN address at download time (resolve_downlink), so it is never stored.
    downlink: str


@dataclass
class GogInstaller:
    id: str
    os: str
    language: str
    version: str | None
    total_size: int
    files: list[GogInstallerFile] = field(default_factory=list)


@dataclass
class GogInstallerGroup:
    """One product's offline installers: the base game, or one of its DLC."""

    product_id: int
    title: str
    installers: list[GogInstaller] = field(default_factory=list)


@dataclass
class GogStoreDetails:
    name: str
    summary: str | None
    cover_url: str | None


def build_login_url() -> str:
    """GOG's login page for the Galaxy client. After signing in, GOG lands on
    GOG_REDIRECT_URI with a `code` query parameter. The redirect URI goes in unencoded,
    exactly as Minigalaxy and Heroic send it."""
    return (
        f"{GOG_AUTH_BASE}/auth?client_id={GOG_CLIENT_ID}"
        f"&redirect_uri={GOG_REDIRECT_URI}"
        "&response_type=code&layout=client2"
    )


class GogClient:
    def __init__(
        self,
        refresh_token: str | None = None,
        http_client: httpx.AsyncClient | None = None,
        access_token: str | None = None,
        access_token_expires_at: float | None = None,
    ) -> None:
        self._refresh_token = refresh_token
        self._http = http_client or httpx.AsyncClient(timeout=10.0)
        # Seedable for the connect flow, which already holds a fresh access token from the
        # code exchange and shouldn't spend a refresh to use it.
        self._access_token_value = access_token
        self._access_token_expires_at = access_token_expires_at or 0.0

    @property
    def refresh_token(self) -> str | None:
        """The current refresh token. GOG returns a new one on every refresh, so callers
        save this back to the user row after any authenticated call."""
        return self._refresh_token

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "GogClient":
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    @_retryable
    async def _request(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        # 400/401/403 become GogAuthError, which tenacity doesn't retry. The only 400s
        # this client can get come from the token endpoint (bad code, revoked token).
        try:
            response = await self._http.request(method, url, **kwargs)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in (400, 401, 403):
                raise GogAuthError("GOG rejected the saved login — connect GOG again on the Integrations page") from exc
            raise
        return response

    async def _request_authed(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        access_token = await self._access_token()
        return await self._request(method, url, headers={"Authorization": f"Bearer {access_token}"}, **kwargs)

    async def _access_token(self) -> str:
        now = time.time()
        if self._access_token_value is not None and now < self._access_token_expires_at - 60:
            return self._access_token_value
        if not self._refresh_token:
            raise GogNotConnectedError("GOG isn't connected yet — connect it in Settings → Integrations")
        response = await self._request(
            "GET",
            f"{GOG_AUTH_BASE}/token",
            params={
                "client_id": GOG_CLIENT_ID,
                "client_secret": GOG_CLIENT_SECRET,
                "grant_type": "refresh_token",
                "refresh_token": self._refresh_token,
            },
        )
        tokens = _tokens_from_payload(response.json())
        self._refresh_token = tokens.refresh_token
        self._access_token_value = tokens.access_token
        self._access_token_expires_at = now + tokens.expires_in
        return tokens.access_token

    @staticmethod
    async def exchange_code(code: str, http_client: httpx.AsyncClient | None = None) -> GogTokens:
        """Swaps the login code for tokens. Not retried: a code is single-use, so a bad or
        expired one is a 400, surfaced as GogAuthError."""
        client = http_client or httpx.AsyncClient(timeout=10.0)
        try:
            response = await client.get(
                f"{GOG_AUTH_BASE}/token",
                params={
                    "client_id": GOG_CLIENT_ID,
                    "client_secret": GOG_CLIENT_SECRET,
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": GOG_REDIRECT_URI,
                },
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in (400, 401, 403):
                raise GogAuthError("That GOG sign-in didn't work — sign in again and paste the new address") from exc
            raise
        finally:
            if http_client is None:
                await client.aclose()
        return _tokens_from_payload(response.json())

    async def get_username(self, user_id: str) -> str | None:
        response = await self._request_authed("GET", f"{GOG_USERS_BASE}/users/{user_id}")
        return response.json().get("username")

    async def get_owned_library(self) -> list[GogOwnedGame]:
        """Every owned game across all pages of getFilteredProducts (mediaType 1 = games,
        so movies are left out)."""
        games: list[GogOwnedGame] = []
        page = 1
        total_pages = 1
        while page <= total_pages:
            response = await self._request_authed(
                "GET", f"{GOG_EMBED_BASE}/account/getFilteredProducts", params={"mediaType": 1, "page": page}
            )
            payload = response.json()
            total_pages = int(payload.get("totalPages") or 1)
            for product in payload.get("products") or []:
                games.append(GogOwnedGame(product_id=int(product["id"]), name=str(product.get("title") or "")))
            page += 1
        return games

    async def get_wishlist_ids(self) -> list[int]:
        """Product ids on the account's GOG wishlist, from embed.gog.com/user/wishlist.json.
        The endpoint exists and needs a sign-in (checked live); its body is documented by
        community tools as {"wishlist": {"<product id>": true, ...}} but hasn't been seen
        signed in yet, so every plausible shape is read: a dict of id -> flag (false entries
        skipped), a list of ids, or a list of objects with an "id"."""
        response = await self._request_authed("GET", f"{GOG_EMBED_BASE}/user/wishlist.json")
        return _parse_wishlist_ids(response.json())

    async def get_product_titles(self, product_ids: list[int]) -> dict[int, str]:
        """Titles for many products in one call to GOG's public products endpoint (no
        sign-in, checked live). Products GOG doesn't return are simply absent."""
        if not product_ids:
            return {}
        response = await self._request(
            "GET",
            f"{GOG_API_BASE}/products",
            params={"ids": ",".join(str(product_id) for product_id in product_ids), "locale": "en-US"},
        )
        payload = response.json()
        rows = payload if isinstance(payload, list) else []
        return {int(row["id"]): str(row["title"]) for row in rows if row.get("id") and row.get("title")}

    async def get_product_downloads(self, product_id: int) -> list[GogInstallerGroup]:
        """The base game's and each owned DLC's offline installers, from the products API
        with expand=downloads,expanded_dlcs (the same call Minigalaxy and Heroic make). An
        installer with no files or no OS has nothing to download and is left out."""
        response = await self._request_authed(
            "GET",
            f"{GOG_API_BASE}/products/{product_id}",
            params={"locale": "en-US", "expand": "downloads,expanded_dlcs"},
        )
        payload = response.json()
        groups = [_installer_group(payload)]
        groups.extend(_installer_group(dlc) for dlc in payload.get("expanded_dlcs") or [])
        return [group for group in groups if group.installers]

    async def resolve_downlink(self, downlink: str) -> str:
        """Turns a file's API downlink into the real CDN address, which only works for a
        short while: resolved right before downloading, never stored."""
        if not downlink.startswith(f"{GOG_API_BASE}/"):
            # Only ever follow GOG's own API links with the account's token.
            raise GogAuthError("GOG returned an unexpected download link")
        response = await self._request_authed("GET", downlink)
        return str(response.json()["downlink"])

    async def get_store_details(self, product_id: int) -> GogStoreDetails | None:
        """Name, portrait box art and summary from GOG's public catalog API, for "Add as
        custom game" on an unmatched entry. No sign-in needed. Called on demand only,
        never during Import. A 404 (product gone from the store) is None."""
        response = await self._http.get(f"{GOG_API_BASE}/v2/games/{product_id}", params={"locale": "en-US"})
        if response.status_code == 404:
            return None
        response.raise_for_status()
        payload = response.json()
        name = (payload.get("_embedded") or {}).get("product", {}).get("title")
        if not name:
            return None
        cover = ((payload.get("_links") or {}).get("boxArtImage") or {}).get("href")
        return GogStoreDetails(name=str(name), summary=_plain_summary(payload.get("description")), cover_url=cover)


def _installer_group(product: dict) -> GogInstallerGroup:
    installers: list[GogInstaller] = []
    for raw in (product.get("downloads") or {}).get("installers") or []:
        files = [
            GogInstallerFile(id=str(item["id"]), size=int(item.get("size") or 0), downlink=str(item["downlink"]))
            for item in raw.get("files") or []
            if item.get("id") and item.get("downlink")
        ]
        if not files or not raw.get("os"):
            continue
        installers.append(
            GogInstaller(
                id=str(raw["id"]),
                os=str(raw["os"]),
                language=str(raw.get("language") or ""),
                version=str(raw["version"]) if raw.get("version") is not None else None,
                total_size=int(raw.get("total_size") or sum(item.size for item in files)),
                files=files,
            )
        )
    return GogInstallerGroup(
        product_id=int(product["id"]), title=str(product.get("title") or ""), installers=installers
    )


def _parse_wishlist_ids(payload: object) -> list[int]:
    items: object = payload.get("wishlist", payload) if isinstance(payload, dict) else payload
    ids: list[int] = []
    if isinstance(items, dict):
        ids = [int(key) for key, flag in items.items() if flag and str(key).isdigit()]
    elif isinstance(items, list):
        for item in items:
            raw = item.get("id") if isinstance(item, dict) else item
            if str(raw).isdigit():
                ids.append(int(raw))
    return list(dict.fromkeys(ids))


def _tokens_from_payload(payload: dict) -> GogTokens:
    access_token = payload.get("access_token")
    refresh_token = payload.get("refresh_token")
    user_id = payload.get("user_id")
    if not access_token or not refresh_token or user_id is None:
        raise GogAuthError("GOG's sign-in response was missing the login details — sign in again")
    return GogTokens(
        access_token=str(access_token),
        refresh_token=str(refresh_token),
        user_id=str(user_id),
        expires_in=int(payload.get("expires_in") or 3600),
    )


def _plain_summary(description: str | None) -> str | None:
    """GOG's store description is HTML, usually opening with promo banner images. Strips
    the markup and collapses whitespace, capped like a summary should be."""
    if not description:
        return None
    text = html.unescape(_TAG_RE.sub(" ", description))
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return None
    if len(text) > _SUMMARY_MAX_CHARS:
        text = text[:_SUMMARY_MAX_CHARS].rsplit(" ", 1)[0] + "…"
    return text
