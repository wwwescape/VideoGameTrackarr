def test_get_share_link_requires_auth(client):
    response = client.get("/api/share-link")

    assert response.status_code == 401


def test_get_share_link_generates_a_token_on_first_call(auth_client):
    response = auth_client.get("/api/share-link")

    assert response.status_code == 200
    token = response.json()["token"]
    assert len(token) > 20


def test_get_share_link_returns_the_same_token_on_repeat_calls(auth_client):
    first = auth_client.get("/api/share-link").json()["token"]
    second = auth_client.get("/api/share-link").json()["token"]

    assert first == second


def test_regenerate_share_link_requires_auth(client):
    response = client.post("/api/share-link/regenerate")

    assert response.status_code == 401


def test_regenerate_share_link_issues_a_new_token(auth_client):
    original = auth_client.get("/api/share-link").json()["token"]

    response = auth_client.post("/api/share-link/regenerate")

    assert response.status_code == 200
    new_token = response.json()["token"]
    assert new_token != original
    assert auth_client.get("/api/share-link").json()["token"] == new_token
