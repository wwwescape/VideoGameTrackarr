import json
import logging
from dataclasses import dataclass

import httpx

from app.services.cache import CacheBackend, get_cache

logger = logging.getLogger(__name__)

GITHUB_REPO = "wwwescape/videogametrackarr"
_RELEASES_LATEST_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
_RELEASES_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases?per_page=50"
_CACHE_KEY = "version:latest_release"
_RELEASES_CACHE_KEY = "version:releases"
# What's New shows at most this many releases (someone upgrading across many at once).
_WHATS_NEW_LIMIT = 10
_CACHE_TTL_SECONDS = 6 * 60 * 60


@dataclass
class LatestRelease:
    tag_name: str
    html_url: str


@dataclass
class Release:
    tag_name: str
    name: str
    body: str
    html_url: str
    published_at: str | None


@dataclass
class WhatsNew:
    current_version: str
    # Newest first; empty when there's nothing new, or the notes couldn't be fetched.
    releases: list[Release]
    # GitHub couldn't be reached: the page shows a link to the release instead.
    notes_unavailable: bool


async def get_latest_release(cache: CacheBackend | None = None, force: bool = False) -> LatestRelease | None:
    """Fetches the repo's latest published GitHub release, cached for _CACHE_TTL_SECONDS via
    the same CacheBackend used for IGDB responses (app/services/cache.py) — one outbound call
    per cache window regardless of how many browser tabs/users poll GET /api/version, rather
    than each one hitting GitHub's unauthenticated rate limit directly.

    `cache` defaults to the process-global get_cache() (real callers); tests pass their own
    fresh InMemoryTTLCache() instead, same pattern as IGDBClient's `cache` parameter, so one
    test's cached response can't leak into another's.

    `force` skips the cache *read* (used by the About page's manual "Check for updates"
    button, via GET /api/version?force=true) — the fresh result still gets written back to
    cache afterward, so it's a one-off bypass of that call only, not a cache-disabling flag;
    background/passive checks keep hitting the shared cache as normal.

    Returns None on any failure (network error, non-2xx, malformed body) — an update check
    must never block login or crash a page over GitHub being unreachable."""
    cache = cache or get_cache()
    cached = None if force else await cache.get(_CACHE_KEY)
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


async def get_releases(cache: CacheBackend | None = None) -> list[Release] | None:
    """The repo's published releases (drafts and pre-releases left out), cached like
    get_latest_release. None when GitHub can't be reached."""
    cache = cache or get_cache()
    payload = await cache.get(_RELEASES_CACHE_KEY)
    if payload is None:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(_RELEASES_URL, headers={"Accept": "application/vnd.github+json"})
                response.raise_for_status()
                payload = response.text
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            logger.warning("Could not fetch GitHub releases: %s", exc)
            return None
        await cache.set(_RELEASES_CACHE_KEY, payload, ttl_seconds=_CACHE_TTL_SECONDS)
    try:
        return [
            Release(
                tag_name=item["tag_name"],
                name=item.get("name") or item["tag_name"],
                body=item.get("body") or "",
                html_url=item["html_url"],
                published_at=item.get("published_at"),
            )
            for item in json.loads(payload)
            if not item.get("draft") and not item.get("prerelease")
        ]
    except (ValueError, KeyError, TypeError):
        return None


async def get_whats_new(
    current_version: str, last_seen_version: str | None, cache: CacheBackend | None = None
) -> WhatsNew:
    """The releases since the version whose What's New you last closed, up to the one running.
    `last_seen_version` is null on an install from before What's New: then only the running
    version's notes show. Nothing shows when you've already seen this version, or when the
    running version has no published release (a development build)."""
    current = _parse_version(current_version)
    last = _parse_version(last_seen_version) if last_seen_version else None
    nothing = WhatsNew(current_version=current_version, releases=[], notes_unavailable=False)
    if current is None or (last is not None and last >= current):
        return nothing
    releases = await get_releases(cache)
    if releases is None:
        return WhatsNew(current_version=current_version, releases=[], notes_unavailable=True)
    picked = []
    for release in releases:
        version = _parse_version(release.tag_name)
        if version is None or version > current:
            continue
        if (last is None and version == current) or (last is not None and version > last):
            picked.append((version, release))
    picked.sort(key=lambda pair: pair[0], reverse=True)
    if not picked or picked[0][0] != current:
        return nothing
    return WhatsNew(
        current_version=current_version,
        releases=[release for _, release in picked[:_WHATS_NEW_LIMIT]],
        notes_unavailable=False,
    )


def release_url_for(version: str) -> str:
    return f"https://github.com/{GITHUB_REPO}/releases/tag/v{version.removeprefix('v')}"


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
