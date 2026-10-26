def test_get_share_link_requires_auth(client):
    response = client.get("/api/share-link")

    assert response.status_code == 401


def test_get_share_link_is_null_until_sharing_is_turned_on(auth_client):
    response = auth_client.get("/api/share-link")

    assert response.status_code == 200
    assert response.json()["token"] is None
    assert auth_client.get("/api/share-link").json()["token"] is None


def test_enable_share_link_creates_a_token_once(auth_client):
    response = auth_client.post("/api/share-link")

    assert response.status_code == 200
    token = response.json()["token"]
    assert len(token) > 20
    assert auth_client.post("/api/share-link").json()["token"] == token
    assert auth_client.get("/api/share-link").json()["token"] == token


def test_disable_share_link_turns_the_public_pages_off(auth_client, client):
    token = auth_client.post("/api/share-link").json()["token"]

    response = auth_client.delete("/api/share-link")

    assert response.status_code == 204
    assert auth_client.get("/api/share-link").json()["token"] is None
    assert client.get(f"/api/public/{token}/games").status_code == 404
    assert auth_client.post("/api/share-link").json()["token"] != token


def test_enable_and_disable_share_link_require_auth(client):
    assert client.post("/api/share-link").status_code == 401
    assert client.delete("/api/share-link").status_code == 401


def test_regenerate_share_link_requires_auth(client):
    response = client.post("/api/share-link/regenerate")

    assert response.status_code == 401


def test_regenerate_share_link_issues_a_new_token(auth_client):
    original = auth_client.post("/api/share-link").json()["token"]

    response = auth_client.post("/api/share-link/regenerate")

    assert response.status_code == 200
    new_token = response.json()["token"]
    assert new_token != original
    assert auth_client.get("/api/share-link").json()["token"] == new_token
