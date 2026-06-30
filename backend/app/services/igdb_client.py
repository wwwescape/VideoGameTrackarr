import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Literal

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.services.cache import CacheBackend, get_cache

logger = logging.getLogger(__name__)

IGDB_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
IGDB_API_BASE = "https://api.igdb.com/v4"

SEARCH_CACHE_TTL_SECONDS = 5 * 60
COVER_CACHE_TTL_SECONDS = 24 * 60 * 60

# IGDB's games.category/game_type ordinal scheme (0-14) — see GameCategory in
# app/models/catalog.py for the named enum this mirrors; kept as bare ints here rather than
# importing that model, since this client only speaks IGDB's wire format and leaves
# interpreting it to the service layer.
#
# Independently ownable/playable releases — what search should surface, and the only things
# someone should be able to add directly: main_game(0), bundle(3), standalone_expansion(4),
# remake(8), remaster(9), expanded_game(10).
_BROWSABLE_GAME_TYPES = (0, 3, 4, 8, 9, 10)
# Content that only makes sense bolted onto an existing copy, never independently playable:
# dlc_addon(1), expansion(2), pack(13). The only categories get_addons_by_parent_igdb_id
# should ever cascade-import alongside a game — everything else a parent_game backlink
# turns up (mods, bundles, remasters, ports, ...) is something the user adds on its own, by
# searching for it directly, not a side effect of adding something else.
_HIERARCHICAL_ADDON_GAME_TYPES = (1, 2, 13)

# IGDB's Apicalypse query language expands relations inline via dot-notation — no extra
# round trips needed for genres/companies/franchises/collections/screenshots/videos/
# release_dates/platforms, verified against the real API while building this (M8). `fields
# *` alone would return these as bare ids; combining it with explicit dot-paths upgrades
# just those fields to nested objects while leaving every scalar field from `*` untouched.
GAME_FIELDS = (
    "fields *,"
    "genres.name,genres.slug,"
    "involved_companies.company.id,involved_companies.company.name,"
    "involved_companies.company.slug,involved_companies.company.logo.url,"
    "involved_companies.developer,involved_companies.publisher,"
    "involved_companies.porting,involved_companies.supporting,"
    "franchises.name,franchises.slug,"
    "collections.name,collections.slug,"
    "screenshots.url,"
    "artworks.url,"
    "videos.video_id,videos.name,"
    "release_dates.date,release_dates.human,release_dates.release_region,"
    "release_dates.platform.id,release_dates.platform.name,"
    "platforms.name,platforms.slug,platforms.abbreviation,"
    # parent_game is IGDB's generic backlink (same field get_addons_by_parent_igdb_id
    # queries against) — expanding it here means a game added directly, rather than
    # discovered via its parent's relation arrays, still carries its conceptual parent's
    # name/url, even when we don't have that parent imported locally ourselves.
    "parent_game.name,parent_game.slug,parent_game.url;"
)

# IGDB/Twitch hiccups and transient network errors are worth retrying; a 4xx (bad
# credentials, malformed query) never gets better on retry, so only retry on
# connection-level failures and 5xx responses.
_retryable = retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)


class IGDBCredentialsError(Exception):
    """Raised when IGDB_CLIENT_ID / IGDB_CLIENT_SECRET aren't configured."""


def _escape_apicalypse_string(value: str) -> str:
    """Apicalypse (IGDB's query language) delimits strings with double quotes; without
    escaping, a search term containing a `"` could break out of the string and inject
    arbitrary query clauses."""
    return value.replace("\\", "\\\\").replace('"', '\\"')


class IGDBClient:
    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        http_client: httpx.AsyncClient | None = None,
        cache: CacheBackend | None = None,
    ) -> None:
        settings = get_settings()
        self._client_id = client_id or settings.igdb_client_id
        self._client_secret = client_secret or settings.igdb_client_secret
        self._http = http_client or httpx.AsyncClient(timeout=10.0)
        self._cache = cache or get_cache()
        self._access_token: str | None = None
        self._token_expires_at: datetime | None = None

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "IGDBClient":
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    @_retryable
    async def _request(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        response = await self._http.request(method, url, **kwargs)
        response.raise_for_status()
        return response

    async def _get_access_token(self) -> str:
        if not self._client_id or not self._client_secret:
            raise IGDBCredentialsError("IGDB_CLIENT_ID / IGDB_CLIENT_SECRET are not configured")

        # 60s safety margin so a token doesn't expire mid-request.
        if (
            self._access_token
            and self._token_expires_at
            and self._token_expires_at > datetime.now(UTC) + timedelta(seconds=60)
        ):
            return self._access_token

        response = await self._request(
            "POST",
            IGDB_TOKEN_URL,
            params={
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "grant_type": "client_credentials",
            },
        )
        data = response.json()
        self._access_token = data["access_token"]
        self._token_expires_at = datetime.now(UTC) + timedelta(seconds=data.get("expires_in", 0))
        return self._access_token

    async def _auth_headers(self) -> dict[str, str]:
        token = await self._get_access_token()
        return {"Client-ID": self._client_id, "Authorization": f"Bearer {token}"}

    async def search_games(
        self, query: str, limit: int = 25, category_scope: Literal["game", "addon"] = "game"
    ) -> list[dict]:
        cache_key = f"igdb:search:{category_scope}:{limit}:{query.lower().strip()}"
        cached = await self._cache.get(cache_key)
        if cached is not None:
            return json.loads(cached)

        headers = await self._auth_headers()
        escaped_query = _escape_apicalypse_string(query)
        if category_scope == "addon":
            # No `| game_type = null` fallback here, unlike the "game" scope below: an
            # unclassified hit being guessed as a DLC/expansion/pack is too risky to surface
            # as a Link-to-IGDB suggestion for a custom addon.
            addon_types = ",".join(str(t) for t in _HIERARCHICAL_ADDON_GAME_TYPES)
            where_clause = f"game_type = ({addon_types})"
        else:
            # Not filtered by parent_game = null: a remaster/standalone expansion/bundle/remake
            # commonly carries a parent_game backlink to the original it's related to, but is
            # still something the user should be able to find and add on its own — the
            # game_type allowlist alone is what keeps DLC/expansion/pack/mods/etc. out of
            # search, regardless of whether they happen to have a backlink.
            browsable_types = ",".join(str(t) for t in _BROWSABLE_GAME_TYPES)
            where_clause = f"game_type = ({browsable_types}) | game_type = null"
        body = f'{GAME_FIELDS}\nsearch "{escaped_query}";\nwhere {where_clause};\nlimit {int(limit)};'
        response = await self._request("POST", f"{IGDB_API_BASE}/games", headers=headers, content=body)
        games = response.json()

        await self._attach_covers(games, headers)
        _normalize_nested_image_urls(games)
        await self._cache.set(cache_key, json.dumps(games), ttl_seconds=SEARCH_CACHE_TTL_SECONDS)
        return games

    async def get_games_by_ids(self, ids: list[int]) -> list[dict]:
        if not ids:
            return []

        headers = await self._auth_headers()
        id_list = ",".join(str(int(i)) for i in ids)
        body = f"{GAME_FIELDS}\nwhere id = ({id_list});\nlimit {len(ids)};"
        response = await self._request("POST", f"{IGDB_API_BASE}/games", headers=headers, content=body)
        games = response.json()

        await self._attach_covers(games, headers)
        _normalize_nested_image_urls(games)
        return games

    async def get_addons_by_parent_igdb_id(self, parent_igdb_id: int) -> list[dict]:
        """The hierarchical addons (DLC/expansion/pack only) of a game per IGDB's
        parent_game relationship — filtered by game_type so importing/resyncing a game only
        ever pulls in content that extends that specific copy. A parent_game backlink also
        turns up siblings (remasters, bundles, standalone expansions, mods, ...), but those
        are independently ownable/playable; cascading them in here is what used to flood the
        database with games nobody asked to add. Strict, no game_type IS NULL fallback:
        unlike search (where benefit of the doubt makes sense for something the user picked
        deliberately), an unclassifiable backlink hit here is exactly the kind of ambiguous
        case that shouldn't get auto-imported as a side effect."""
        headers = await self._auth_headers()
        hierarchical_types = ",".join(str(t) for t in _HIERARCHICAL_ADDON_GAME_TYPES)
        body = (
            f"{GAME_FIELDS}\n"
            f"where parent_game = {int(parent_igdb_id)} & game_type = ({hierarchical_types});\n"
            f"limit 100;"
        )
        response = await self._request("POST", f"{IGDB_API_BASE}/games", headers=headers, content=body)
        addons = response.json()

        await self._attach_covers(addons, headers)
        _normalize_nested_image_urls(addons)
        return addons

    async def _attach_covers(self, games: list[dict], headers: dict[str, str]) -> None:
        cover_ids = [game["cover"] for game in games if game.get("cover")]
        if not cover_ids:
            return

        cover_urls = await self.get_covers_by_ids(cover_ids, headers=headers)
        for game in games:
            if game.get("cover"):
                game["cover_url"] = cover_urls.get(game["cover"])

    async def get_covers_by_ids(
        self, cover_ids: list[int], headers: dict[str, str] | None = None
    ) -> dict[int, str]:
        """Batched, per-id cached cover lookup — at most one HTTP request for whatever
        isn't already cached, instead of one request per game."""
        if not cover_ids:
            return {}

        result: dict[int, str] = {}
        uncached_ids: list[int] = []
        for cover_id in cover_ids:
            cached = await self._cache.get(f"igdb:cover:{cover_id}")
            if cached is not None:
                result[cover_id] = cached
            else:
                uncached_ids.append(cover_id)

        if uncached_ids:
            headers = headers or await self._auth_headers()
            id_list = ",".join(str(int(i)) for i in uncached_ids)
            body = f"fields url;\nwhere id = ({id_list});\nlimit {len(uncached_ids)};"
            response = await self._request("POST", f"{IGDB_API_BASE}/covers", headers=headers, content=body)

            for cover in response.json():
                url = _normalize_cover_url(cover.get("url"))
                if url:
                    result[cover["id"]] = url
                    await self._cache.set(f"igdb:cover:{cover['id']}", url, ttl_seconds=COVER_CACHE_TTL_SECONDS)

        return result


def _normalize_image_url(url: str | None, size: str) -> str | None:
    if not url:
        return None

    sized_url = url.replace("t_thumb", size)
    return f"https:{sized_url}" if sized_url.startswith("//") else sized_url


def _normalize_cover_url(url: str | None) -> str | None:
    # t_cover_big is only 264x374 — fine for the small search-result thumbnails this size
    # was presumably chosen for, but covers get reused at much larger sizes too (the game
    # detail page's cover card, grid tiles on wide/high-DPI displays), where 264px wide
    # source data upscales visibly soft next to the surrounding vector/text UI. t_720p fits
    # a portrait cover within 1280x720 (≈540x720 for a 3:4 cover) — comfortably sharp at any
    # size this app actually renders one, without going as far as the much larger t_1080p.
    return _normalize_image_url(url, "t_720p")


def _normalize_nested_image_urls(games: list[dict]) -> None:
    """Screenshots and company logos arrive as full objects (via GAME_FIELDS' dot-path
    expansion, not a separate batched lookup like covers/_attach_covers) — their urls just
    need the same thumb->bigger-size upgrade applied in place."""
    for game in games:
        for screenshot in game.get("screenshots") or []:
            screenshot["url"] = _normalize_image_url(screenshot.get("url"), "t_screenshot_big")
        for artwork in game.get("artworks") or []:
            artwork["url"] = _normalize_image_url(artwork.get("url"), "t_1080p")
        for involved_company in game.get("involved_companies") or []:
            company = involved_company.get("company") or {}
            logo = company.get("logo")
            if logo:
                logo["url"] = _normalize_image_url(logo.get("url"), "t_thumb")
