from app.core.config import get_app_version
from app.services import version_service
from app.services.version_service import LatestRelease


def test_get_version_requires_auth(client):
    response = client.get("/api/version")

    assert response.status_code == 401


def test_get_version_reports_update_available(auth_client, monkeypatch):
    async def fake_get_latest_release(cache=None):
        return LatestRelease(tag_name="v999.0.0", html_url="https://example.com/releases/v999.0.0")

    monkeypatch.setattr(version_service, "get_latest_release", fake_get_latest_release)

    response = auth_client.get("/api/version")

    assert response.status_code == 200
    body = response.json()
    assert body["currentVersion"] == get_app_version()
    assert body["latestVersion"] == "v999.0.0"
    assert body["updateAvailable"] is True
    assert body["releaseUrl"] == "https://example.com/releases/v999.0.0"


def test_get_version_reports_no_update_when_already_current(auth_client, monkeypatch):
    async def fake_get_latest_release(cache=None):
        return LatestRelease(tag_name=f"v{get_app_version()}", html_url="https://example.com")

    monkeypatch.setattr(version_service, "get_latest_release", fake_get_latest_release)

    response = auth_client.get("/api/version")

    assert response.status_code == 200
    assert response.json()["updateAvailable"] is False


def test_get_version_degrades_gracefully_when_github_is_unreachable(auth_client, monkeypatch):
    async def fake_get_latest_release(cache=None):
        return None

    monkeypatch.setattr(version_service, "get_latest_release", fake_get_latest_release)

    response = auth_client.get("/api/version")

    assert response.status_code == 200
    body = response.json()
    assert body["currentVersion"] == get_app_version()
    assert body["latestVersion"] is None
    assert body["updateAvailable"] is False
    assert body["releaseUrl"] is None
