import httpx
import respx

from app.services import version_service
from app.services.cache import InMemoryTTLCache
from app.services.version_service import GITHUB_REPO, is_newer

_RELEASES_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"


def test_is_newer_when_latest_is_ahead():
    assert is_newer("v1.4.0", "1.3.0") is True


def test_is_newer_when_already_current():
    assert is_newer("v1.3.0", "1.3.0") is False


def test_is_newer_when_running_ahead_of_latest():
    assert is_newer("v1.3.0", "1.4.0") is False


def test_is_newer_handles_missing_v_prefix():
    assert is_newer("1.4.0", "1.3.0") is True


def test_is_newer_returns_false_for_a_malformed_tag():
    assert is_newer("not-a-version", "1.3.0") is False
    assert is_newer("v1.4.0", "also-not-a-version") is False


@respx.mock
async def test_get_latest_release_parses_tag_and_url():
    respx.get(_RELEASES_URL).mock(
        return_value=httpx.Response(200, json={"tag_name": "v1.4.0", "html_url": "https://example.com/releases/v1.4.0"})
    )

    release = await version_service.get_latest_release(cache=InMemoryTTLCache())

    assert release is not None
    assert release.tag_name == "v1.4.0"
    assert release.html_url == "https://example.com/releases/v1.4.0"


@respx.mock
async def test_get_latest_release_caches_across_calls():
    route = respx.get(_RELEASES_URL).mock(
        return_value=httpx.Response(200, json={"tag_name": "v1.4.0", "html_url": "https://example.com"})
    )
    cache = InMemoryTTLCache()

    await version_service.get_latest_release(cache=cache)
    await version_service.get_latest_release(cache=cache)

    assert route.call_count == 1


@respx.mock
async def test_get_latest_release_force_bypasses_cache():
    route = respx.get(_RELEASES_URL).mock(
        side_effect=[
            httpx.Response(200, json={"tag_name": "v1.4.0", "html_url": "https://example.com/v1.4.0"}),
            httpx.Response(200, json={"tag_name": "v1.5.0", "html_url": "https://example.com/v1.5.0"}),
        ]
    )
    cache = InMemoryTTLCache()

    first = await version_service.get_latest_release(cache=cache)
    forced = await version_service.get_latest_release(cache=cache, force=True)

    assert route.call_count == 2
    assert first.tag_name == "v1.4.0"
    assert forced.tag_name == "v1.5.0"


@respx.mock
async def test_get_latest_release_force_still_refreshes_cache_for_later_non_forced_calls():
    route = respx.get(_RELEASES_URL).mock(
        side_effect=[
            httpx.Response(200, json={"tag_name": "v1.4.0", "html_url": "https://example.com/v1.4.0"}),
            httpx.Response(200, json={"tag_name": "v1.5.0", "html_url": "https://example.com/v1.5.0"}),
        ]
    )
    cache = InMemoryTTLCache()

    await version_service.get_latest_release(cache=cache)
    await version_service.get_latest_release(cache=cache, force=True)
    third = await version_service.get_latest_release(cache=cache)

    assert route.call_count == 2
    assert third.tag_name == "v1.5.0"


@respx.mock
async def test_get_latest_release_returns_none_on_http_error():
    respx.get(_RELEASES_URL).mock(return_value=httpx.Response(500))

    release = await version_service.get_latest_release(cache=InMemoryTTLCache())

    assert release is None


@respx.mock
async def test_get_latest_release_returns_none_on_network_failure():
    respx.get(_RELEASES_URL).mock(side_effect=httpx.ConnectError("boom"))

    release = await version_service.get_latest_release(cache=InMemoryTTLCache())

    assert release is None


@respx.mock
async def test_get_latest_release_returns_none_for_malformed_body():
    respx.get(_RELEASES_URL).mock(return_value=httpx.Response(200, content=b"not json"))

    release = await version_service.get_latest_release(cache=InMemoryTTLCache())

    assert release is None
