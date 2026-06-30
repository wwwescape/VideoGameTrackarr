from app.models.library import GameProgress


def test_add_library_item_requires_auth(client, seed_game):
    response = client.post(f"/api/games/{seed_game.id}/library", json={"status": "owned"})

    assert response.status_code == 401


def test_add_library_item_404_for_missing_game(auth_client):
    response = auth_client.post("/api/games/999999/library", json={"status": "owned"})

    assert response.status_code == 404


def test_add_owned_library_item(auth_client, seed_game, seed_platform, seed_region):
    response = auth_client.post(
        f"/api/games/{seed_game.id}/library",
        json={
            "status": "owned",
            "platformId": seed_platform.id,
            "regionId": seed_region.id,
            "format": "physical",
            "edition": "Game of the Year",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["gameId"] == seed_game.id
    assert body["status"] == "owned"
    assert body["platformName"] == "PlayStation 5"
    assert body["regionName"] == "PAL"
    assert body["format"] == "physical"
    assert body["edition"] == "Game of the Year"


def test_add_wishlist_item_with_no_platform(auth_client, seed_game):
    response = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "wishlist"})

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "wishlist"
    assert body["platformId"] is None


def test_list_library_items_filters_by_status(auth_client, seed_game):
    auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "owned"})
    auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "wishlist"})

    owned = auth_client.get(f"/api/games/{seed_game.id}/library", params={"status": "owned"})
    everything = auth_client.get(f"/api/games/{seed_game.id}/library")

    assert [i["status"] for i in owned.json()] == ["owned"]
    assert sorted(i["status"] for i in everything.json()) == ["owned", "wishlist"]


def test_update_library_item_moves_wishlist_to_owned(auth_client, seed_game):
    created = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "wishlist"}).json()

    response = auth_client.put(f"/api/library/{created['id']}", json={"status": "owned"})

    assert response.status_code == 200
    assert response.json()["status"] == "owned"


def test_update_library_item_partial_update_does_not_clobber_other_fields(auth_client, seed_game, seed_platform):
    created = auth_client.post(
        f"/api/games/{seed_game.id}/library",
        json={"status": "owned", "platformId": seed_platform.id, "edition": "Deluxe"},
    ).json()

    response = auth_client.put(f"/api/library/{created['id']}", json={"notes": "Bought on sale"})

    assert response.status_code == 200
    body = response.json()
    assert body["edition"] == "Deluxe"
    assert body["platformId"] == seed_platform.id
    assert body["notes"] == "Bought on sale"


def test_add_library_item_with_price(auth_client, seed_game):
    response = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "owned", "price": 59.99})

    assert response.status_code == 201
    assert response.json()["price"] == 59.99


def test_update_library_item_sets_price(auth_client, seed_game):
    created = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "owned"}).json()
    assert created["price"] is None

    response = auth_client.put(f"/api/library/{created['id']}", json={"price": 19.99})

    assert response.status_code == 200
    assert response.json()["price"] == 19.99


def test_update_library_item_404_for_missing_item(auth_client):
    response = auth_client.put("/api/library/999999", json={"status": "owned"})

    assert response.status_code == 404


def test_delete_library_item(auth_client, seed_game):
    created = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "wishlist"}).json()

    response = auth_client.delete(f"/api/library/{created['id']}")
    assert response.status_code == 204

    remaining = auth_client.get(f"/api/games/{seed_game.id}/library")
    assert remaining.json() == []


def test_delete_library_item_404_for_missing_item(auth_client):
    response = auth_client.delete("/api/library/999999")

    assert response.status_code == 404


def test_adding_library_item_does_not_create_game_progress(auth_client, db_session, seed_game):
    """Library items (ownership/wishlist) and game progress (play status) are
    deliberately separate concerns — adding a library item shouldn't silently create a
    progress row too."""
    auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "owned"})

    assert db_session.query(GameProgress).filter_by(game_id=seed_game.id).count() == 0
