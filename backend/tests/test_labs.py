"""Settings > Labs: VGT's feature flags, and the Game Shelf lab gating its routes."""

import pytest

from app.models.game_cases import GameCase
from app.models.labs import LabFeature
from tests.test_backup_routes import _upload_backup, _wait_for_restore_completion

ALL_OFF = [
    {"id": "game_shelf", "enabled": False},
    {"id": "screensaver", "enabled": False},
    {"id": "filter_presets", "enabled": False},
]


def _share_token(client) -> str:
    return client.post("/api/share-link").json()["token"]


def test_labs_require_auth(client):
    assert client.get("/api/labs").status_code == 401
    assert client.put("/api/labs/game_shelf", json={"enabled": True}).status_code == 401


def test_every_lab_starts_off(auth_client):
    assert auth_client.get("/api/labs").json() == ALL_OFF


def test_turning_a_lab_on_and_off(auth_client, db_session):
    response = auth_client.put("/api/labs/game_shelf", json={"enabled": True})
    assert response.status_code == 200
    assert response.json() == {"id": "game_shelf", "enabled": True}
    assert db_session.get(LabFeature, "game_shelf").enabled is True

    auth_client.put("/api/labs/game_shelf", json={"enabled": False})
    assert auth_client.get("/api/labs").json() == ALL_OFF


def test_an_unknown_lab_is_404(auth_client):
    assert auth_client.put("/api/labs/time_travel", json={"enabled": True}).status_code == 404


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/games/shelf"),
        ("get", "/api/game-cases"),
        ("put", "/api/game-cases/1"),
    ],
)
def test_game_shelf_routes_are_404_while_the_lab_is_off(auth_client, method, path):
    kwargs = {"json": {"shown": False}} if method == "put" else {}
    assert getattr(auth_client, method)(path, **kwargs).status_code == 404


def test_game_shelf_routes_work_while_the_lab_is_on(auth_client, game_shelf_lab):
    assert auth_client.get("/api/games/shelf").status_code == 200
    assert auth_client.get("/api/game-cases").status_code == 200


def test_the_share_page_only_shows_the_shelf_while_the_lab_is_on(auth_client):
    token = _share_token(auth_client)
    assert auth_client.get(f"/api/public/{token}/labs").json() == {"enabled": []}
    assert auth_client.get(f"/api/public/{token}/shelf").status_code == 404

    auth_client.put("/api/labs/game_shelf", json={"enabled": True})
    assert auth_client.get(f"/api/public/{token}/labs").json() == {"enabled": ["game_shelf"]}
    assert auth_client.get(f"/api/public/{token}/shelf").status_code == 200


def test_public_labs_needs_a_valid_token(client):
    assert client.get("/api/public/not-a-token/labs").status_code == 404


def test_a_backup_carries_labs_and_case_choices(auth_client, db_session, game_shelf_lab):
    case = db_session.query(GameCase).filter_by(platform_slug="ps4").one()
    auth_client.put(f"/api/game-cases/{case.id}", json={"shown": False})
    backup = auth_client.get("/api/export/backup").json()
    assert backup["lab_features"] == [{"id": "game_shelf", "enabled": True}]
    assert {"platform_slug": "ps4", "shown": False} in backup["game_cases"]

    # Change both, then restore.
    auth_client.put("/api/labs/game_shelf", json={"enabled": False})
    db_session.query(GameCase).update({GameCase.shown: True})
    db_session.commit()
    assert _upload_backup(auth_client, backup).status_code == 202
    assert _wait_for_restore_completion(auth_client)["status"] == "completed"

    db_session.expire_all()
    assert db_session.get(LabFeature, "game_shelf").enabled is True
    assert db_session.query(GameCase).filter_by(platform_slug="ps4").one().shown is False
    assert db_session.query(GameCase).filter_by(platform_slug="ps5").one().shown is True


def test_an_older_backup_leaves_labs_and_cases_alone(auth_client, db_session, game_shelf_lab):
    case = db_session.query(GameCase).filter_by(platform_slug="ps4").one()
    case.shown = False
    db_session.commit()
    old = {"version": 5, "exported_at": "2026-01-01T00:00:00+00:00"}
    assert _upload_backup(auth_client, old).status_code == 202
    assert _wait_for_restore_completion(auth_client)["status"] == "completed"

    db_session.expire_all()
    assert db_session.get(LabFeature, "game_shelf").enabled is True
    assert db_session.query(GameCase).filter_by(platform_slug="ps4").one().shown is False
