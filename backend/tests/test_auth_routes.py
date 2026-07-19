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
    assert response.json() == {"id": test_user.id, "username": "admin"}


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
    response = client.post("/api/auth/setup", json={"username": "admin", "password": "a-strong-password"})

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
    response = client.post("/api/auth/setup", json={"username": "someone-else", "password": "a-strong-password"})

    assert response.status_code == 409


def test_setup_rejects_short_password(client):
    response = client.post("/api/auth/setup", json={"username": "admin", "password": "short"})

    assert response.status_code == 422


def test_setup_rejects_short_username(client):
    response = client.post("/api/auth/setup", json={"username": "ab", "password": "a-strong-password"})

    assert response.status_code == 422


def test_setup_rate_limited_after_five_attempts(client):
    for _ in range(5):
        client.post("/api/auth/setup", json={"username": "admin", "password": "a-strong-password"})

    response = client.post("/api/auth/setup", json={"username": "admin", "password": "a-strong-password"})

    assert response.status_code == 429
