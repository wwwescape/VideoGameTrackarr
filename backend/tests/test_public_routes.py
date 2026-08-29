def _get_token(auth_client):
    return auth_client.get("/api/share-link").json()["token"]


def test_public_games_with_valid_token(auth_client, client, seed_game):
    token = _get_token(auth_client)

    response = client.get(f"/api/public/{token}/games")

    assert response.status_code == 200
    body = response.json()
    assert [game["name"] for game in body] == ["Test Game"]
    game = body[0]
    assert set(game.keys()) == {"id", "name", "coverUrl", "category", "firstReleaseDate", "owned", "wishlisted"}


def test_public_games_wrong_token_is_404(client, seed_game):
    response = client.get("/api/public/not-a-real-token/games")

    assert response.status_code == 404


def test_public_games_search_filters_results(auth_client, client, seed_game):
    token = _get_token(auth_client)

    matching = client.get(f"/api/public/{token}/games", params={"search": "Test"})
    nonmatching = client.get(f"/api/public/{token}/games", params={"search": "Nonexistent"})

    assert [game["name"] for game in matching.json()] == ["Test Game"]
    assert nonmatching.json() == []


def test_public_devices_with_valid_token(auth_client, client, seed_device):
    token = _get_token(auth_client)

    response = client.get(f"/api/public/{token}/devices")

    assert response.status_code == 200
    body = response.json()
    assert [device["officialName"] for device in body] == ["Test Console"]
    device = body[0]
    assert set(device.keys()) == {
        "id",
        "officialName",
        "manufacturerName",
        "hardwarePlatformName",
        "imageUrl",
        "owned",
        "wishlisted",
        "ownedQuantity",
    }


def test_public_devices_wrong_token_is_404(client, seed_device):
    response = client.get("/api/public/not-a-real-token/devices")

    assert response.status_code == 404


def test_public_accessories_with_valid_token(auth_client, client, seed_accessory):
    token = _get_token(auth_client)

    response = client.get(f"/api/public/{token}/accessories")

    assert response.status_code == 200
    body = response.json()
    assert [accessory["officialName"] for accessory in body] == ["Test Controller"]
    accessory = body[0]
    assert set(accessory.keys()) == {
        "id",
        "officialName",
        "manufacturerName",
        "imageUrl",
        "owned",
        "wishlisted",
        "ownedQuantity",
    }


def test_public_accessories_wrong_token_is_404(client, seed_accessory):
    response = client.get("/api/public/not-a-real-token/accessories")

    assert response.status_code == 404
