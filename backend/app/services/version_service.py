import json
import logging
from dataclasses import dataclass

import httpx

from app.services.cache import CacheBackend, get_cache

logger = logging.getLogger(__name__)

GITHUB_REPO = "wwwescape/videogametrackarr"
_RELEASES_LATEST_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
_CACHE_KEY = "version:latest_release"
_CACHE_TTL_SECONDS = 6 * 60 * 60


@dataclass
class LatestRelease:
    tag_name: str
    html_url: str


async def get_latest_release(cache: CacheBackend | None = None) -> LatestRelease | None:
    """Fetches the repo's latest published GitHub release, cached for _CACHE_TTL_SECONDS via
    the same CacheBackend used for IGDB responses (app/services/cache.py) — one outbound call
    per cache window regardless of how many browser tabs/users poll GET /api/version, rather
    than each one hitting GitHub's unauthenticated rate limit directly.

    `cache` defaults to the process-global get_cache() (real callers); tests pass their own
    fresh InMemoryTTLCache() instead, same pattern as IGDBClient's `cache` parameter, so one
    test's cached response can't leak into another's.

    Returns None on any failure (network error, non-2xx, malformed body) — an update check
    must never block login or crash a page over GitHub being unreachable."""
    cache = cache or get_cache()
    cached = await cache.get(_CACHE_KEY)
    if cached is not None:
        return _parse_release_payload(cached)

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(_RELEASES_LATEST_URL, headers={"Accept": "application/vnd.github+json"})
            response.raise_for_status()
            payload = response.text
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.warning("Could not fetch latest GitHub release: %s", exc)
        return None

    await cache.set(_CACHE_KEY, payload, ttl_seconds=_CACHE_TTL_SECONDS)
    return _parse_release_payload(payload)


def _parse_release_payload(payload: str) -> LatestRelease | None:
    try:
        data = json.loads(payload)
        return LatestRelease(tag_name=data["tag_name"], html_url=data["html_url"])
    except (ValueError, KeyError, TypeError):
        return None


def _parse_version(version: str) -> tuple[int, ...] | None:
    """"v1.4.0" / "1.4.0" -> (1, 4, 0). None for anything non-numeric, so a malformed tag
    never crashes the comparison — just never claims an update is available."""
    try:
        return tuple(int(part) for part in version.removeprefix("v").split("."))
    except ValueError:
        return None


def is_newer(latest_tag: str, current_version: str) -> bool:
    latest = _parse_version(latest_tag)
    current = _parse_version(current_version)
    if latest is None or current is None:
        return False
    return latest > current
