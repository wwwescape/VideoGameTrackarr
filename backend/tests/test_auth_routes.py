from app.services import auth_service


def test_login_success_returns_tokens(client, test_user):
    response = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})

    assert response.status_code == 200
    body = response.json()
    assert body["tokenType"] == "bearer"
    assert body["accessToken"]
    assert body["refreshToken"]


def test_login_wrong_password_rejected(client, test_user):
    response = client.post("/api/auth/login", json={"username": "admin", "password": "wrong-password"})

    assert response.status_code == 401


def test_login_unknown_user_rejected(client, test_user):
    response = client.post("/api/auth/login", json={"username": "nobody", "password": "whatever"})

    assert response.status_code == 401


def test_login_rate_limited_after_five_attempts(client, test_user):
    for _ in range(5):
        client.post("/api/auth/login", json={"username": "admin", "password": "wrong-password"})

    response = client.post("/api/auth/login", json={"username": "admin", "password": "wrong-password"})

    assert response.status_code == 429


def test_me_requires_auth(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_me_returns_current_user_with_valid_access_token(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    access_token = login.json()["accessToken"]

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {access_token}"})

    assert response.status_code == 200
    assert response.json() == {
        "id": test_user.id,
        "username": "admin",
        "currency": None,
        "overviewLayout": None,
        "gameFilterFields": None,
        "savedGameFilters": None,
    }


def test_me_rejects_garbage_token(client):
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})

    assert response.status_code == 401


def test_refresh_issues_new_tokens(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    old_refresh_token = login.json()["refreshToken"]

    response = client.post("/api/auth/refresh", json={"refreshToken": old_refresh_token})

    assert response.status_code == 200
    new_tokens = response.json()
    assert new_tokens["refreshToken"] != old_refresh_token


def test_refresh_token_cannot_be_replayed_after_rotation(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    old_refresh_token = login.json()["refreshToken"]

    client.post("/api/auth/refresh", json={"refreshToken": old_refresh_token})
    replay = client.post("/api/auth/refresh", json={"refreshToken": old_refresh_token})

    assert replay.status_code == 401


def test_logout_revokes_refresh_token(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    refresh_token = login.json()["refreshToken"]

    logout = client.post("/api/auth/logout", json={"refreshToken": refresh_token})
    assert logout.status_code == 204

    reuse = client.post("/api/auth/refresh", json={"refreshToken": refresh_token})
    assert reuse.status_code == 401


def test_logout_is_idempotent_for_already_revoked_token(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    refresh_token = login.json()["refreshToken"]

    first = client.post("/api/auth/logout", json={"refreshToken": refresh_token})
    second = client.post("/api/auth/logout", json={"refreshToken": refresh_token})

    assert first.status_code == 204
    assert second.status_code == 204


def test_access_token_rejected_at_refresh_endpoint(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    access_token = login.json()["accessToken"]

    response = client.post("/api/auth/refresh", json={"refreshToken": access_token})

    assert response.status_code == 401


def test_setup_status_reports_required_when_no_users(client):
    response = client.get("/api/auth/setup-status")

    assert response.status_code == 200
    assert response.json() == {"setupRequired": True}


def test_setup_status_reports_not_required_once_a_user_exists(client, test_user):
    response = client.get("/api/auth/setup-status")

    assert response.status_code == 200
    assert response.json() == {"setupRequired": False}


def test_setup_creates_first_user_and_logs_in(client):
    response = client.post(
        "/api/auth/setup", json={"username": "admin", "password": "a-strong-password", "setupCode": _setup_code()}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["tokenType"] == "bearer"
    assert body["accessToken"]
    assert body["refreshToken"]

    assert client.get("/api/auth/setup-status").json() == {"setupRequired": False}

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['accessToken']}"})
    assert me.status_code == 200
    assert me.json()["username"] == "admin"


def test_setup_rejected_once_a_user_already_exists(client, test_user):
    response = client.post(
        "/api/auth/setup",
        json={"username": "someone-else", "password": "a-strong-password", "setupCode": _setup_code()},
    )

    assert response.status_code == 409


def test_setup_rejects_short_password(client):
    response = client.post(
        "/api/auth/setup", json={"username": "admin", "password": "short", "setupCode": _setup_code()}
    )

    assert response.status_code == 422


def test_setup_rejects_short_username(client):
    response = client.post(
        "/api/auth/setup", json={"username": "ab", "password": "a-strong-password", "setupCode": _setup_code()}
    )

    assert response.status_code == 422


def test_setup_rate_limited_after_five_attempts(client):
    for _ in range(5):
        client.post(
            "/api/auth/setup", json={"username": "admin", "password": "a-strong-password", "setupCode": _setup_code()}
        )

    response = client.post(
        "/api/auth/setup", json={"username": "admin", "password": "a-strong-password", "setupCode": _setup_code()}
    )

    assert response.status_code == 429


def _setup_code() -> str:

    return auth_service.get_setup_code()


def test_setup_refuses_a_wrong_setup_code(client):
    response = client.post(
        "/api/auth/setup", json={"username": "admin", "password": "a-strong-password", "setupCode": "WRONG-CODE"}
    )

    assert response.status_code == 403
    assert client.get("/api/auth/setup-status").json() == {"setupRequired": True}


def test_setup_accepts_the_code_in_any_case_with_or_without_the_dash(client):
    code = _setup_code().replace("-", " ").lower()

    response = client.post(
        "/api/auth/setup", json={"username": "admin", "password": "a-strong-password", "setupCode": code}
    )

    assert response.status_code == 200


def test_setup_uses_the_configured_setup_code(client, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "setup_code", "my-own-code")

    wrong = client.post(
        "/api/auth/setup", json={"username": "admin", "password": "a-strong-password", "setupCode": "XXXX"}
    )
    right = client.post(
        "/api/auth/setup", json={"username": "admin", "password": "a-strong-password", "setupCode": "MY-OWN-CODE"}
    )

    assert wrong.status_code == 403
    assert right.status_code == 200


def test_change_password_signs_other_sessions_out_and_keeps_this_one(client, test_user):
    first = client.post("/api/auth/login", json={"username": test_user.username, "password": "correct-password"}).json()
    other = client.post("/api/auth/login", json={"username": test_user.username, "password": "correct-password"}).json()

    response = client.post(
        "/api/auth/change-password",
        json={"currentPassword": "correct-password", "newPassword": "a-brand-new-password"},
        headers={"Authorization": f"Bearer {first['accessToken']}"},
    )

    assert response.status_code == 200
    assert client.post("/api/auth/refresh", json={"refreshToken": other["refreshToken"]}).status_code == 401
    assert client.post("/api/auth/refresh", json={"refreshToken": response.json()["refreshToken"]}).status_code == 200
    login = client.post("/api/auth/login", json={"username": test_user.username, "password": "a-brand-new-password"})
    assert login.status_code == 200


def test_change_password_rejects_a_wrong_current_password(client, test_user):
    tokens = client.post(
        "/api/auth/login", json={"username": test_user.username, "password": "correct-password"}
    ).json()

    response = client.post(
        "/api/auth/change-password",
        json={"currentPassword": "not-it", "newPassword": "a-brand-new-password"},
        headers={"Authorization": f"Bearer {tokens['accessToken']}"},
    )

    assert response.status_code == 400


def test_change_password_rejects_a_short_new_password(auth_client):
    response = auth_client.post(
        "/api/auth/change-password", json={"currentPassword": "correct-password", "newPassword": "short"}
    )

    assert response.status_code == 422


def test_change_password_requires_auth(client):
    response = client.post(
        "/api/auth/change-password", json={"currentPassword": "x", "newPassword": "a-brand-new-password"}
    )

    assert response.status_code == 401


def test_currency_is_saved_on_the_account(auth_client):
    assert auth_client.get("/api/auth/me").json()["currency"] is None

    response = auth_client.put("/api/auth/me/preferences", json={"currency": "EUR"})

    assert response.status_code == 200
    assert response.json()["currency"] == "EUR"
    assert auth_client.get("/api/auth/me").json()["currency"] == "EUR"


def test_currency_must_be_a_three_letter_code(auth_client):
    assert auth_client.put("/api/auth/me/preferences", json={"currency": "euro"}).status_code == 422


def test_reusing_a_rotated_refresh_token_signs_every_session_out(client, test_user, monkeypatch):
    monkeypatch.setattr(auth_service, "REUSE_GRACE_SECONDS", -1)
    stolen = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"}).json()
    other = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"}).json()
    rotated = client.post("/api/auth/refresh", json={"refreshToken": stolen["refreshToken"]}).json()

    replay = client.post("/api/auth/refresh", json={"refreshToken": stolen["refreshToken"]})

    assert replay.status_code == 401
    assert client.post("/api/auth/refresh", json={"refreshToken": rotated["refreshToken"]}).status_code == 401
    assert client.post("/api/auth/refresh", json={"refreshToken": other["refreshToken"]}).status_code == 401


def test_reusing_a_rotated_refresh_token_within_the_grace_period_keeps_other_sessions(client, test_user):
    first = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"}).json()
    rotated = client.post("/api/auth/refresh", json={"refreshToken": first["refreshToken"]}).json()

    assert client.post("/api/auth/refresh", json={"refreshToken": first["refreshToken"]}).status_code == 401
    assert client.post("/api/auth/refresh", json={"refreshToken": rotated["refreshToken"]}).status_code == 200


def test_a_logged_out_refresh_token_does_not_sign_other_sessions_out(client, test_user, monkeypatch):
    monkeypatch.setattr(auth_service, "REUSE_GRACE_SECONDS", -1)
    first = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"}).json()
    other = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"}).json()
    client.post("/api/auth/logout", json={"refreshToken": first["refreshToken"]})

    assert client.post("/api/auth/refresh", json={"refreshToken": first["refreshToken"]}).status_code == 401
    assert client.post("/api/auth/refresh", json={"refreshToken": other["refreshToken"]}).status_code == 200


def test_unknown_username_is_still_checked_against_a_hash(client, monkeypatch):
    checked = []
    real_verify = auth_service.verify_password
    monkeypatch.setattr(auth_service, "verify_password", lambda pw, h: checked.append(h) or real_verify(pw, h))

    response = client.post("/api/auth/login", json={"username": "nobody", "password": "whatever"})

    assert response.status_code == 401
    assert checked == [auth_service._DUMMY_PASSWORD_HASH]


def test_setup_rejects_a_password_longer_than_72_bytes(client):
    response = client.post(
        "/api/auth/setup", json={"username": "admin", "password": "é" * 37, "setupCode": _setup_code()}
    )

    assert response.status_code == 422


def test_change_password_rejects_a_password_longer_than_72_bytes(auth_client):
    response = auth_client.post(
        "/api/auth/change-password", json={"currentPassword": "correct-password", "newPassword": "x" * 73}
    )

    assert response.status_code == 422


def test_overview_layout_is_saved_on_the_account(auth_client):
    layout = [{"key": "onSale", "hidden": False}, {"key": "quickAdd", "hidden": True}]

    response = auth_client.put("/api/auth/me/preferences", json={"overviewLayout": layout})

    assert response.status_code == 200
    assert response.json()["overviewLayout"] == layout
    assert auth_client.get("/api/auth/me").json()["overviewLayout"] == layout


def test_preferences_only_change_the_fields_sent(auth_client):
    auth_client.put("/api/auth/me/preferences", json={"currency": "EUR"})
    auth_client.put("/api/auth/me/preferences", json={"overviewLayout": [{"key": "events", "hidden": True}]})

    me = auth_client.get("/api/auth/me").json()

    assert me["currency"] == "EUR"
    assert me["overviewLayout"] == [{"key": "events", "hidden": True}]


def test_overview_layout_keys_are_validated(auth_client):
    layout = [{"key": "<script>", "hidden": False}]

    response = auth_client.put("/api/auth/me/preferences", json={"overviewLayout": layout})

    assert response.status_code == 422


def test_game_filter_fields_are_saved_on_the_account(auth_client):
    fields = [{"key": "format", "hidden": True}, {"key": "genre", "hidden": False}]

    response = auth_client.put("/api/auth/me/preferences", json={"gameFilterFields": fields})

    assert response.status_code == 200
    assert auth_client.get("/api/auth/me").json()["gameFilterFields"] == fields


def test_saved_game_filters_are_kept_as_sent(auth_client):
    saved = [{"name": "Couch Switch", "filters": {"platformScopes": ["130"], "localPlayersMin": 2, "coopOnly": True}}]

    response = auth_client.put("/api/auth/me/preferences", json={"savedGameFilters": saved})

    assert response.status_code == 200
    me = auth_client.get("/api/auth/me").json()
    assert me["savedGameFilters"] == saved
    # Saving filters leaves the other preferences alone.
    assert me["gameFilterFields"] is None


def test_saved_game_filters_need_a_name_and_stay_small(auth_client):
    unnamed = [{"name": "", "filters": {}}]
    huge = [{"name": "Huge", "filters": {"tagIds": list(range(5000))}}]

    assert auth_client.put("/api/auth/me/preferences", json={"savedGameFilters": unnamed}).status_code == 422
    assert auth_client.put("/api/auth/me/preferences", json={"savedGameFilters": huge}).status_code == 422
