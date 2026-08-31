from app.models.library import GameProgress, LibraryItem, LibraryStatus, PlaySession


def _own_platform(db_session, game_id: int, platform_id: int) -> None:
    db_session.add(LibraryItem(game_id=game_id, platform_id=platform_id, status=LibraryStatus.OWNED))
    db_session.commit()


def test_list_progress_requires_auth(client, seed_game):
    response = client.get(f"/api/games/{seed_game.id}/progress")

    assert response.status_code == 401


def test_list_progress_empty_when_no_rows_exist(auth_client, seed_game):
    response = auth_client.get(f"/api/games/{seed_game.id}/progress")

    assert response.status_code == 200
    assert response.json() == []


def test_list_progress_404_for_missing_game(auth_client):
    response = auth_client.get("/api/games/999999/progress")

    assert response.status_code == 404


def test_create_progress_requires_owned_platform(auth_client, seed_game, seed_platform):
    response = auth_client.post(
        f"/api/games/{seed_game.id}/progress", json={"platformId": seed_platform.id, "playStatus": "playing"}
    )

    assert response.status_code == 409


def test_create_progress_on_an_owned_platform(auth_client, db_session, seed_game, seed_platform):
    _own_platform(db_session, seed_game.id, seed_platform.id)

    response = auth_client.post(
        f"/api/games/{seed_game.id}/progress",
        json={"platformId": seed_platform.id, "playStatus": "playing", "rating": 8.5},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["platformId"] == seed_platform.id
    assert body["playStatus"] == "playing"
    assert body["rating"] == 8.5
    assert db_session.query(GameProgress).filter_by(game_id=seed_game.id).count() == 1


def test_create_progress_rejects_a_second_row_for_the_same_platform(auth_client, db_session, seed_game, seed_platform):
    _own_platform(db_session, seed_game.id, seed_platform.id)
    auth_client.post(f"/api/games/{seed_game.id}/progress", json={"platformId": seed_platform.id})

    response = auth_client.post(f"/api/games/{seed_game.id}/progress", json={"platformId": seed_platform.id})

    assert response.status_code == 409


def test_update_progress_partial_update_does_not_clobber_other_fields(
    auth_client, db_session, seed_game, seed_platform
):
    _own_platform(db_session, seed_game.id, seed_platform.id)
    create_response = auth_client.post(
        f"/api/games/{seed_game.id}/progress",
        json={"platformId": seed_platform.id, "playStatus": "playing", "rating": 7},
    )
    progress_id = create_response.json()["id"]

    response = auth_client.put(f"/api/progress/{progress_id}", json={"playtimeMinutes": 120})

    assert response.status_code == 200
    body = response.json()
    assert body["playStatus"] == "playing"
    assert body["rating"] == 7
    assert body["playtimeMinutes"] == 120


def test_update_progress_rejects_out_of_range_rating(auth_client, db_session, seed_game, seed_platform):
    _own_platform(db_session, seed_game.id, seed_platform.id)
    create_response = auth_client.post(f"/api/games/{seed_game.id}/progress", json={"platformId": seed_platform.id})
    progress_id = create_response.json()["id"]

    response = auth_client.put(f"/api/progress/{progress_id}", json={"rating": 11})

    assert response.status_code == 422


def test_update_progress_404_for_missing_row(auth_client):
    response = auth_client.put("/api/progress/999999", json={"rating": 5})

    assert response.status_code == 404


def test_delete_progress(auth_client, db_session, seed_game, seed_platform):
    _own_platform(db_session, seed_game.id, seed_platform.id)
    create_response = auth_client.post(f"/api/games/{seed_game.id}/progress", json={"platformId": seed_platform.id})
    progress_id = create_response.json()["id"]

    response = auth_client.delete(f"/api/progress/{progress_id}")

    assert response.status_code == 204
    assert auth_client.get(f"/api/games/{seed_game.id}/progress").json() == []


def test_delete_progress_404_for_missing_row(auth_client):
    response = auth_client.delete("/api/progress/999999")

    assert response.status_code == 404


def test_game_summary_and_detail_expose_derived_play_status_and_rating(
    auth_client, db_session, seed_game, seed_platform
):
    _own_platform(db_session, seed_game.id, seed_platform.id)
    auth_client.post(
        f"/api/games/{seed_game.id}/progress",
        json={"platformId": seed_platform.id, "playStatus": "completed", "rating": 9},
    )

    list_response = auth_client.get("/api/games")
    detail_response = auth_client.get(f"/api/games/{seed_game.slug}")

    assert list_response.json()[0]["playStatus"] == "completed"
    assert list_response.json()[0]["rating"] == 9
    assert detail_response.json()["progress"]["playStatus"] == "completed"


def test_derived_status_prioritizes_playing_over_backlog_across_platforms(
    auth_client, db_session, seed_game, seed_platform, seed_pc_platform
):
    # A game backlogged on PC but actively being played on PS5 should read as "playing"
    # everywhere a single game-level status is shown (list, card, dashboard) — not whichever
    # platform happens to sort first.
    _own_platform(db_session, seed_game.id, seed_platform.id)
    _own_platform(db_session, seed_game.id, seed_pc_platform.id)
    auth_client.post(
        f"/api/games/{seed_game.id}/progress",
        json={"platformId": seed_pc_platform.id, "playStatus": "backlog", "rating": 5},
    )
    auth_client.post(
        f"/api/games/{seed_game.id}/progress",
        json={"platformId": seed_platform.id, "playStatus": "playing", "rating": 8},
    )

    list_response = auth_client.get("/api/games")
    detail_response = auth_client.get(f"/api/games/{seed_game.slug}")

    assert list_response.json()[0]["playStatus"] == "playing"
    assert list_response.json()[0]["rating"] == 8
    assert detail_response.json()["progress"]["playStatus"] == "playing"


def test_play_sessions_requires_auth(client, seed_game):
    response = client.get(f"/api/games/{seed_game.id}/play-sessions")

    assert response.status_code == 401


def test_create_play_session_requires_owned_platform(auth_client, seed_game, seed_platform):
    response = auth_client.post(
        f"/api/games/{seed_game.id}/play-sessions",
        json={"platformId": seed_platform.id, "startedAt": "2026-01-01T10:00:00Z"},
    )

    assert response.status_code == 409


def test_create_play_session_computes_duration_from_start_and_end(auth_client, db_session, seed_game, seed_platform):
    _own_platform(db_session, seed_game.id, seed_platform.id)

    response = auth_client.post(
        f"/api/games/{seed_game.id}/play-sessions",
        json={"platformId": seed_platform.id, "startedAt": "2026-01-01T10:00:00Z", "endedAt": "2026-01-01T11:30:00Z"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["durationMinutes"] == 90
    assert body["platformId"] == seed_platform.id


def test_create_play_session_respects_explicit_duration(auth_client, db_session, seed_game, seed_platform):
    _own_platform(db_session, seed_game.id, seed_platform.id)

    response = auth_client.post(
        f"/api/games/{seed_game.id}/play-sessions",
        json={
            "platformId": seed_platform.id,
            "startedAt": "2026-01-01T10:00:00Z",
            "endedAt": "2026-01-01T11:30:00Z",
            "durationMinutes": 45,
        },
    )

    assert response.json()["durationMinutes"] == 45


def test_create_play_session_404_for_missing_game(auth_client, seed_platform):
    response = auth_client.post(
        "/api/games/999999/play-sessions", json={"platformId": seed_platform.id, "startedAt": "2026-01-01T10:00:00Z"}
    )

    assert response.status_code == 404


def test_multiple_play_sessions_allowed_on_the_same_platform(auth_client, db_session, seed_game, seed_platform):
    _own_platform(db_session, seed_game.id, seed_platform.id)

    first = auth_client.post(
        f"/api/games/{seed_game.id}/play-sessions",
        json={"platformId": seed_platform.id, "startedAt": "2026-01-01T10:00:00Z"},
    )
    second = auth_client.post(
        f"/api/games/{seed_game.id}/play-sessions",
        json={"platformId": seed_platform.id, "startedAt": "2026-01-02T10:00:00Z"},
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert db_session.query(PlaySession).filter_by(game_id=seed_game.id).count() == 2


def test_list_play_sessions_orders_newest_first(auth_client, db_session, seed_game, seed_platform):
    _own_platform(db_session, seed_game.id, seed_platform.id)
    auth_client.post(
        f"/api/games/{seed_game.id}/play-sessions",
        json={"platformId": seed_platform.id, "startedAt": "2026-01-01T10:00:00Z"},
    )
    auth_client.post(
        f"/api/games/{seed_game.id}/play-sessions",
        json={"platformId": seed_platform.id, "startedAt": "2026-02-01T10:00:00Z"},
    )

    response = auth_client.get(f"/api/games/{seed_game.id}/play-sessions")

    assert response.status_code == 200
    started = [row["startedAt"] for row in response.json()]
    assert started == sorted(started, reverse=True)


def test_update_play_session(auth_client, db_session, seed_game, seed_platform):
    _own_platform(db_session, seed_game.id, seed_platform.id)
    create_response = auth_client.post(
        f"/api/games/{seed_game.id}/play-sessions",
        json={"platformId": seed_platform.id, "startedAt": "2026-01-01T10:00:00Z"},
    )
    session_id = create_response.json()["id"]

    response = auth_client.put(f"/api/play-sessions/{session_id}", json={"notes": "Got past the first boss"})

    assert response.status_code == 200
    assert response.json()["notes"] == "Got past the first boss"


def test_update_play_session_404_for_missing_session(auth_client):
    response = auth_client.put("/api/play-sessions/999999", json={"notes": "x"})

    assert response.status_code == 404


def test_delete_play_session(auth_client, db_session, seed_game, seed_platform):
    _own_platform(db_session, seed_game.id, seed_platform.id)
    create_response = auth_client.post(
        f"/api/games/{seed_game.id}/play-sessions",
        json={"platformId": seed_platform.id, "startedAt": "2026-01-01T10:00:00Z"},
    )
    session_id = create_response.json()["id"]

    response = auth_client.delete(f"/api/play-sessions/{session_id}")

    assert response.status_code == 204
    assert auth_client.get(f"/api/games/{seed_game.id}/play-sessions").json() == []


def test_delete_play_session_404_for_missing_session(auth_client):
    response = auth_client.delete("/api/play-sessions/999999")

    assert response.status_code == 404
