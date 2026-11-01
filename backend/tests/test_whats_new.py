import httpx
import respx

from app.api.routes import version as version_routes
from app.models.system import User
from app.services import version_service
from app.services.cache import InMemoryTTLCache
from app.services.version_service import Release


def _release(version: str) -> Release:
    return Release(
        tag_name=f"v{version}",
        name=f"v{version}",
        body=f"## ✨ New: Things in {version}",
        html_url=f"https://github.com/wwwescape/videogametrackarr/releases/tag/v{version}",
        published_at="2026-11-02T00:00:00Z",
    )


def _fake_releases(versions: list[str] | None, calls: list | None = None):
    async def fake(cache=None):
        if calls is not None:
            calls.append(1)
        return None if versions is None else [_release(version) for version in versions]

    return fake


async def test_an_install_from_before_whats_new_sees_only_the_running_version(monkeypatch):
    monkeypatch.setattr(version_service, "get_releases", _fake_releases(["2.8.0", "2.7.0", "2.6.0"]))

    whats_new = await version_service.get_whats_new("2.7.0", None)

    assert [release.tag_name for release in whats_new.releases] == ["v2.7.0"]
    assert whats_new.notes_unavailable is False


async def test_every_release_since_the_last_one_seen_newest_first(monkeypatch):
    monkeypatch.setattr(version_service, "get_releases", _fake_releases(["2.5.0", "2.7.0", "2.6.1", "2.6.0", "2.8.0"]))

    whats_new = await version_service.get_whats_new("2.7.0", "2.6.0")

    # Not 2.6.0 (seen), not 2.8.0 (newer than what's running).
    assert [release.tag_name for release in whats_new.releases] == ["v2.7.0", "v2.6.1"]


async def test_nothing_once_seen_and_github_is_not_asked(monkeypatch):
    calls: list = []
    monkeypatch.setattr(version_service, "get_releases", _fake_releases(["2.7.0"], calls))

    assert (await version_service.get_whats_new("2.7.0", "2.7.0")).releases == []
    assert (await version_service.get_whats_new("2.7.0", "2.8.0")).releases == []
    assert calls == []


async def test_nothing_for_a_build_with_no_published_release(monkeypatch):
    """A development build: its version isn't on GitHub yet, so there are no notes to show."""
    monkeypatch.setattr(version_service, "get_releases", _fake_releases(["2.6.1", "2.6.0"]))

    whats_new = await version_service.get_whats_new("2.7.0", "2.6.0")

    assert whats_new.releases == []
    assert whats_new.notes_unavailable is False


async def test_github_unreachable_asks_for_a_link_instead(monkeypatch):
    monkeypatch.setattr(version_service, "get_releases", _fake_releases(None))

    whats_new = await version_service.get_whats_new("2.7.0", "2.6.0")

    assert whats_new.releases == []
    assert whats_new.notes_unavailable is True


async def test_at_most_ten_releases(monkeypatch):
    monkeypatch.setattr(version_service, "get_releases", _fake_releases([f"2.{n}.0" for n in range(20)]))

    whats_new = await version_service.get_whats_new("2.19.0", "1.0.0")

    assert len(whats_new.releases) == 10
    assert whats_new.releases[0].tag_name == "v2.19.0"


@respx.mock
async def test_get_releases_leaves_out_drafts_and_prereleases_and_caches():
    route = respx.get("https://api.github.com/repos/wwwescape/videogametrackarr/releases?per_page=50").mock(
        return_value=httpx.Response(
            200,
            json=[
                {"tag_name": "v2.8.0-rc1", "name": "rc", "body": "", "html_url": "u", "prerelease": True},
                {"tag_name": "v2.8.0", "name": "draft", "body": "", "html_url": "u", "draft": True},
                {"tag_name": "v2.7.0", "name": None, "body": None, "html_url": "u", "published_at": "2026-11-02"},
            ],
        )
    )
    cache = InMemoryTTLCache()

    releases = await version_service.get_releases(cache)
    await version_service.get_releases(cache)

    assert [(r.tag_name, r.name, r.body) for r in releases] == [("v2.7.0", "v2.7.0", "")]
    assert route.call_count == 1


@respx.mock
async def test_get_releases_returns_none_when_github_fails():
    respx.get("https://api.github.com/repos/wwwescape/videogametrackarr/releases?per_page=50").mock(
        return_value=httpx.Response(503)
    )

    assert await version_service.get_releases(InMemoryTTLCache()) is None


def test_whats_new_requires_auth(client):
    assert client.get("/api/version/whats-new").status_code == 401
    assert client.post("/api/version/whats-new/seen").status_code == 401


def test_whats_new_shows_once_then_marked_seen(auth_client, db_session, monkeypatch):
    monkeypatch.setattr(version_routes, "get_app_version", lambda: "2.7.0")
    monkeypatch.setattr(version_service, "get_releases", _fake_releases(["2.7.0", "2.6.0"]))

    first = auth_client.get("/api/version/whats-new").json()

    assert first["currentVersion"] == "2.7.0"
    assert [release["version"] for release in first["releases"]] == ["2.7.0"]
    assert first["releases"][0]["body"] == "## ✨ New: Things in 2.7.0"
    assert first["releaseUrl"] == "https://github.com/wwwescape/videogametrackarr/releases/tag/v2.7.0"

    assert auth_client.post("/api/version/whats-new/seen").status_code == 204
    db_session.expire_all()
    assert db_session.query(User).one().last_seen_version == "2.7.0"
    assert auth_client.get("/api/version/whats-new").json()["releases"] == []


def test_a_new_install_starts_with_nothing_to_show(client, db_session):
    from app.services import auth_service

    auth_service.create_initial_admin(db_session, "admin", "a-strong-password", auth_service.get_setup_code())

    user = db_session.query(User).one()
    assert user.last_seen_version == version_routes.get_app_version()
