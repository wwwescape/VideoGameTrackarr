import httpx
import respx

from app.core.config import get_settings
from app.models.catalog import Collection
from app.services import catalog_resync_job
from app.services.catalog_resync_job import CatalogResyncKind
from app.services.igdb_client import IGDB_API_BASE, IGDB_TOKEN_URL

TOKEN_RESPONSE = httpx.Response(200, json={"access_token": "test-token", "expires_in": 3600})


def _configure_igdb(monkeypatch):
    monkeypatch.setattr(get_settings(), "igdb_client_id", "test-client-id")
    monkeypatch.setattr(get_settings(), "igdb_client_secret", "test-client-secret")


@respx.mock
def test_status_surfaces_per_game_failures(auth_client, db_session, monkeypatch):
    """Regression test for failures being collected internally (catalog_resync_job.py) but
    never reaching the API response — a real user hit exactly this with a game IGDB reports
    as a genuine collection member that nonetheless failed to import, and had no way to see
    why since the status endpoint only ever reported counts."""
    _configure_igdb(monkeypatch)
    collection = Collection(igdb_id=14393, name="Planet Zoo", slug="planet-zoo")
    db_session.add(collection)
    db_session.commit()

    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/collections").mock(
        return_value=httpx.Response(200, json=[{"id": 14393, "games": [{"id": 402959, "game_type": 0}]}])
    )
    respx.post(f"{IGDB_API_BASE}/games").mock(return_value=httpx.Response(200, json=[]))  # not found -> failure

    catalog_resync_job._run_resync(CatalogResyncKind.COLLECTION, 14393, lambda: db_session)

    response = auth_client.get("/api/catalog-resync/status")

    assert response.status_code == 200
    result = response.json()["result"]
    assert result["failed"] == 1
    [failure] = result["failures"]
    assert failure["igdbId"] == 402959
    assert "not found" in failure["error"].lower()
