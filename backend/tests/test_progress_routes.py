from app.models.library import GameProgress


def test_get_progress_requires_auth(client, seed_game):
    response = client.get(f"/api/games/{seed_game.id}/progress")

    assert response.status_code == 401


def test_get_progress_returns_default_when_no_row_exists(auth_client, seed_game):
    response = auth_client.get(f"/api/games/{seed_game.id}/progress")

    assert response.status_code == 200
    body = response.json()
    assert body["playStatus"] == "none"
    assert body["playtimeMinutes"] == 0
    assert body["rating"] is None


def test_get_progress_404_for_missing_game(auth_client):
    response = auth_client.get("/api/games/999999/progress")

    assert response.status_code == 404


def test_update_progress_creates_row_on_first_write(auth_client, db_session, seed_game):
    response = auth_client.put(
        f"/api/games/{seed_game.id}/progress",
        json={"playStatus": "playing", "rating": 8.5},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["playStatus"] == "playing"
    assert body["rating"] == 8.5
    assert db_session.query(GameProgress).filter_by(game_id=seed_game.id).count() == 1


def test_update_progress_partial_update_does_not_clobber_other_fields(auth_client, seed_game):
    auth_client.put(f"/api/games/{seed_game.id}/progress", json={"playStatus": "playing", "rating": 7})

    response = auth_client.put(f"/api/games/{seed_game.id}/progress", json={"playtimeMinutes": 120})

    assert response.status_code == 200
    body = response.json()
    assert body["playStatus"] == "playing"
    assert body["rating"] == 7
    assert body["playtimeMinutes"] == 120


def test_update_progress_rejects_out_of_range_rating(auth_client, seed_game):
    response = auth_client.put(f"/api/games/{seed_game.id}/progress", json={"rating": 11})

    assert response.status_code == 422


def test_game_summary_and_detail_expose_play_status_and_rating(auth_client, seed_game):
    auth_client.put(f"/api/games/{seed_game.id}/progress", json={"playStatus": "completed", "rating": 9})

    list_response = auth_client.get("/api/games")
    detail_response = auth_client.get(f"/api/games/{seed_game.slug}")

    assert list_response.json()[0]["playStatus"] == "completed"
    assert list_response.json()[0]["rating"] == 9
    assert detail_response.json()["progress"]["playStatus"] == "completed"


def test_play_sessions_requires_auth(client, seed_game):
    response = client.get(f"/api/games/{seed_game.id}/play-sessions")

    assert response.status_code == 401


def test_create_play_session_computes_duration_from_start_and_end(auth_client, seed_game):
    response = auth_client.post(
        f"/api/games/{seed_game.id}/play-sessions",
        json={"startedAt": "2026-01-01T10:00:00Z", "endedAt": "2026-01-01T11:30:00Z"},
    )

    assert response.status_code == 201
    assert response.json()["durationMinutes"] == 90


def test_create_play_session_respects_explicit_duration(auth_client, seed_game):
    response = auth_client.post(
        f"/api/games/{seed_game.id}/play-sessions",
        json={
            "startedAt": "2026-01-01T10:00:00Z",
            "endedAt": "2026-01-01T11:30:00Z",
            "durationMinutes": 45,
        },
    )

    assert response.json()["durationMinutes"] == 45


def test_create_play_session_404_for_missing_game(auth_client):
    response = auth_client.post(
        "/api/games/999999/play-sessions", json={"startedAt": "2026-01-01T10:00:00Z"}
    )

    assert response.status_code == 404


def test_list_play_sessions_orders_newest_first(auth_client, seed_game):
    auth_client.post(f"/api/games/{seed_game.id}/play-sessions", json={"startedAt": "2026-01-01T10:00:00Z"})
    auth_client.post(f"/api/games/{seed_game.id}/play-sessions", json={"startedAt": "2026-02-01T10:00:00Z"})

    response = auth_client.get(f"/api/games/{seed_game.id}/play-sessions")

    assert response.status_code == 200
    started = [row["startedAt"] for row in response.json()]
    assert started == sorted(started, reverse=True)


def test_update_play_session(auth_client, seed_game):
    create_response = auth_client.post(
        f"/api/games/{seed_game.id}/play-sessions", json={"startedAt": "2026-01-01T10:00:00Z"}
    )
    session_id = create_response.json()["id"]

    response = auth_client.put(f"/api/play-sessions/{session_id}", json={"notes": "Got past the first boss"})

    assert response.status_code == 200
    assert response.json()["notes"] == "Got past the first boss"


def test_update_play_session_404_for_missing_session(auth_client):
    response = auth_client.put("/api/play-sessions/999999", json={"notes": "x"})

    assert response.status_code == 404


def test_delete_play_session(auth_client, db_session, seed_game):
    create_response = auth_client.post(
        f"/api/games/{seed_game.id}/play-sessions", json={"startedAt": "2026-01-01T10:00:00Z"}
    )
    session_id = create_response.json()["id"]

    response = auth_client.delete(f"/api/play-sessions/{session_id}")

    assert response.status_code == 204
    assert auth_client.get(f"/api/games/{seed_game.id}/play-sessions").json() == []


def test_delete_play_session_404_for_missing_session(auth_client):
    response = auth_client.delete("/api/play-sessions/999999")

    assert response.status_code == 404
