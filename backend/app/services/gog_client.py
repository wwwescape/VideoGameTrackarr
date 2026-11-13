import time
from dataclasses import dataclass, field

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.services.exceptions import ConflictError

GOG_AUTH_BASE = "https://auth.gog.com"
GOG_EMBED_BASE = "https://embed.gog.com"
GOG_API_BASE = "https://api.gog.com"
GOG_USERS_BASE = "https://users.gog.com"

# The Galaxy client's own OAuth credentials — effectively public and stable for
# 10+ years; Heroic Games Launcher and Minigalaxy ship the same pair, and the
# login flow below mirrors theirs (auth.gog.com/auth with layout=client2, then
# the code exchanged at auth.gog.com/token). No secret of the user's is involved:
# the per-user secret is the refresh token, stored in plaintext on the user
# row — this codebase has no at-rest encryption for stored secrets (the
# Steam/IGDB keys live in environment variables instead), so the token is only
# as safe as the database itself. See gog_service.py.
GOG_CLIENT_ID = "46899977096215655"
GOG_CLIENT_SECRET = "9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9"
GOG_REDIRECT_URI = "https://embed.gog.com/on_login_success?origin=client"

# Same reasoning as steam_client.py's _retryable: transient network/5xx failures are worth
# retrying, a 4xx (bad code, revoked token, malformed request) never gets better on retry.
_retryable = retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)


class GogAuthError(Exception):
    """Raised when GOG rejects the credentials — a bad/expired auth code, or a
    revoked refresh token. The user re-connects on the Integrations page."""


class GogNotConfiguredError(ConflictError):
    """Raised when no GOG refresh token is saved yet — a 409, like the
    RetroAchievements equivalent, so the frontend shows the setup state instead
    of a generic error."""


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
    """One product's installers — the base game, or one of its DLCs (from
    expanded_dlcs)."""

    product_id: int
    title: str
    installers: list[GogInstaller] = field(default_factory=list)


def build_authorize_url() -> str:
    """The GOG login page the user opens to connect — same URL Minigalaxy builds
    (get_login_url). After signing in, GOG redirects to GOG_REDIRECT_URI with a
    `code` query param the user pastes back on the Integrations page."""
    params = (
        f"client_id={GOG_CLIENT_ID}"
        f"&redirect_uri={GOG_REDIRECT_URI}"
        "&response_type=code"
        "&layout=client2"
    )
    return f"{GOG_AUTH_BASE}/auth?{params}"


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
        # Seedable for the connect flow, which already holds a fresh access token
        # from the code exchange and shouldn't spend a refresh to use it.
        self._cached_access_token: str | None = access_token
        self._access_token_expires_at: float = access_token_expires_at or 0.0

    @property
    def refresh_token(self) -> str | None:
        """The current refresh token — rotated on every refresh, so the caller
        persists this back to the user row after any authenticated call."""
        return self._refresh_token

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "GogClient":
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    @_retryable
    async def _request(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        # Auth failures are converted here: 400/401/403 raise GogAuthError, which
        # tenacity does NOT retry. Transport errors and 5xx propagate as-is so
        # tenacity retries them. (The only 400s this client can produce come from
        # the token endpoint — a bad code or a revoked refresh token — so treating
        # every 400 as an auth failure is correct for this client.)
        try:
            response = await self._http.request(method, url, **kwargs)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in (400, 401, 403):
                raise GogAuthError(
                    "GOG rejected the saved login — reconnect GOG on the Integrations page"
                ) from exc
            raise
        return response

    async def _request_authed(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        """An authenticated request — refreshes the access token first when it is
        missing or expired."""
        access_token = await self._access_token()
        return await self._request(
            method, url, headers={"Authorization": f"Bearer {access_token}"}, **kwargs
        )

    async def _access_token(self) -> str:
        now = time.time()
        if self._cached_access_token is not None and now < self._access_token_expires_at - 60:
            return self._cached_access_token
        if not self._refresh_token:
            raise GogNotConfiguredError("GOG isn't connected yet — connect it on the Integrations page")
        tokens = await self._refresh(self._refresh_token)
        self._refresh_token = tokens.refresh_token
        self._cached_access_token = tokens.access_token
        self._access_token_expires_at = now + tokens.expires_in
        return self._cached_access_token

    async def _refresh(self, refresh_token: str) -> GogTokens:
        # A 400/401 from the token endpoint is already converted to GogAuthError
        # inside _request, so this just returns the fresh tokens.
        response = await self._request(
            "GET",
            f"{GOG_AUTH_BASE}/token",
            params={
                "client_id": GOG_CLIENT_ID,
                "client_secret": GOG_CLIENT_SECRET,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
        )
        return _tokens_from_payload(response.json())

    @staticmethod
    async def exchange_code(code: str, http_client: httpx.AsyncClient | None = None) -> GogTokens:
        """Exchanges the authorization code from the GOG login redirect for tokens.
        A static method (no refresh token exists yet) — the caller persists the
        returned refresh token. A bad/expired code is a 400 from GOG, surfaced as
        GogAuthError rather than a retryable failure."""
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
            if exc.response.status_code in (400, 401):
                raise GogAuthError("That GOG login code didn't work — try signing in again") from exc
            raise
        finally:
            if http_client is None:
                await client.aclose()
        return _tokens_from_payload(response.json())

    async def get_username(self, user_id: str) -> str | None:
        """The account's display name, for the Integrations page — the users endpoint
        returns {"username": ...} for the token's own account."""
        response = await self._request_authed("GET", f"{GOG_USERS_BASE}/users/{user_id}")
        return response.json().get("username")

    async def get_owned_library(self) -> list[GogOwnedGame]:
        """Every owned game (id + title), across all pages of getFilteredProducts —
        the same endpoint Minigalaxy's library uses (mediaType 1 = games)."""
        games: list[GogOwnedGame] = []
        page = 1
        total_pages = 1
        while page <= total_pages:
            response = await self._request_authed(
                "GET",
                f"{GOG_EMBED_BASE}/account/getFilteredProducts",
                params={"mediaType": 1, "page": page},
            )
            payload = response.json()
            total_pages = int(payload.get("totalPages", 1))
            for product in payload.get("products", []):
                games.append(GogOwnedGame(product_id=int(product["id"]), name=str(product["title"])))
            page += 1
        return games

    async def get_product_downloads(self, product_id: int) -> list[GogInstallerGroup]:
        """The base game plus each DLC's installers for one GOG product, from the
        products API with expand=downloads,expanded_dlcs (Minigalaxy's get_info).
        An installer with no files (or no OS) is skipped — nothing downloadable."""
        response = await self._request_authed(
            "GET",
            f"{GOG_API_BASE}/products/{product_id}",
            params={"locale": "en-US", "expand": "downloads,expanded_dlcs"},
        )
        payload = response.json()
        groups: list[GogInstallerGroup] = [_group_from_product(payload)]
        for dlc in payload.get("expanded_dlcs", []) or []:
            groups.append(_group_from_product(dlc))
        return [group for group in groups if group.installers]

    async def resolve_downlink(self, downlink_url: str) -> str:
        """Resolves a file's downlink URL to the real, time-limited CDN URL — the
        downlink must be resolved at download time and never stored (Minigalaxy's
        get_real_download_link)."""
        response = await self._request_authed("GET", downlink_url)
        return str(response.json()["downlink"])


def _tokens_from_payload(payload: dict) -> GogTokens:
    access_token = payload.get("access_token")
    refresh_token = payload.get("refresh_token")
    user_id = payload.get("user_id")
    if not access_token or not refresh_token or user_id is None:
        raise GogAuthError("GOG's token response was missing the login details — try signing in again")
    return GogTokens(
        access_token=str(access_token),
        refresh_token=str(refresh_token),
        user_id=str(user_id),
        expires_in=int(payload.get("expires_in", 3600)),
    )


def _group_from_product(product: dict) -> GogInstallerGroup:
    installers: list[GogInstaller] = []
    for raw in (product.get("downloads") or {}).get("installers", []) or []:
        files = [
            GogInstallerFile(id=str(f["id"]), size=int(f.get("size", 0)), downlink=str(f["downlink"]))
            for f in raw.get("files", []) or []
            if f.get("downlink")
        ]
        if not files or not raw.get("os"):
            continue
        installers.append(
            GogInstaller(
                id=str(raw["id"]),
                os=str(raw["os"]),
                language=str(raw.get("language", "")),
                version=str(raw["version"]) if raw.get("version") is not None else None,
                total_size=int(raw.get("total_size", 0)),
                files=files,
            )
        )
    return GogInstallerGroup(
        product_id=int(product["id"]),
        title=str(product.get("title", "")),
        installers=installers,
    )
