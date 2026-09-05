from app.models.itad import ItadPriceCache
from app.models.library import GameProgress
from app.models.platprices import PlatPricesCache


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
    assert body["platformSlug"] == "ps5"
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


def test_add_wishlist_item_with_target_price(auth_client, seed_game):
    response = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "wishlist", "targetPrice": 15.0})

    assert response.status_code == 201
    assert response.json()["targetPrice"] == 15.0


def test_update_library_item_sets_target_price(auth_client, seed_game):
    created = auth_client.post(f"/api/games/{seed_game.id}/library", json={"status": "wishlist"}).json()
    assert created["targetPrice"] is None

    response = auth_client.put(f"/api/library/{created['id']}", json={"targetPrice": 9.99})

    assert response.status_code == 200
    assert response.json()["targetPrice"] == 9.99


def test_add_wishlist_item_with_track_for_sales(auth_client, seed_game):
    response = auth_client.post(
        f"/api/games/{seed_game.id}/library", json={"status": "wishlist", "trackForSales": True}
    )

    assert response.status_code == 201
    assert response.json()["trackForSales"] is True


def test_update_library_item_toggles_track_for_sales_off(auth_client, seed_game):
    created = auth_client.post(
        f"/api/games/{seed_game.id}/library", json={"status": "wishlist", "trackForSales": True}
    ).json()
    assert created["trackForSales"] is True

    response = auth_client.put(f"/api/library/{created['id']}", json={"trackForSales": False})

    assert response.status_code == 200
    assert response.json()["trackForSales"] is False


def test_list_library_items_reflects_a_current_discount_for_an_eligible_digital_pc_row(
    auth_client, db_session, seed_game, seed_pc_platform
):
    db_session.add(
        ItadPriceCache(
            game_id=seed_game.id,
            itad_game_id="itad-1",
            current_price_amount=14.99,
            current_price_currency="USD",
            current_shop_name="GOG",
            current_cut=40,
        )
    )
    db_session.commit()

    auth_client.post(
        f"/api/games/{seed_game.id}/library",
        json={
            "status": "wishlist",
            "format": "digital",
            "platformId": seed_pc_platform.id,
            "trackForSales": True,
        },
    )

    response = auth_client.get(f"/api/games/{seed_game.id}/library")

    [item] = response.json()
    assert item["isOnSale"] is True
    assert item["salePriceAmount"] == 14.99
    assert item["saleShopName"] == "GOG"
    assert item["saleCut"] == 40


def test_list_library_items_is_not_on_sale_for_a_non_itad_platform(auth_client, db_session, seed_game, seed_platform):
    db_session.add(
        ItadPriceCache(game_id=seed_game.id, itad_game_id="itad-1", current_price_amount=14.99, current_cut=40)
    )
    db_session.commit()

    auth_client.post(
        f"/api/games/{seed_game.id}/library",
        json={"status": "wishlist", "format": "digital", "platformId": seed_platform.id},
    )

    response = auth_client.get(f"/api/games/{seed_game.id}/library")

    [item] = response.json()
    assert item["isOnSale"] is False
    assert item["salePriceAmount"] is None


def test_list_library_items_reflects_a_current_discount_for_an_eligible_digital_ps5_row(
    auth_client, db_session, seed_game, seed_platform
):
    # conftest's seed_platform is "Sony PlayStation 5" (slug "ps5").
    db_session.add(
        PlatPricesCache(
            game_id=seed_game.id,
            ppid="222",
            current_price_amount=19.99,
            current_price_currency="USD",
            current_shop_name="PlayStation Store",
            current_cut=50,
        )
    )
    db_session.commit()

    auth_client.post(
        f"/api/games/{seed_game.id}/library",
        json={
            "status": "wishlist",
            "format": "digital",
            "platformId": seed_platform.id,
            "trackForSales": True,
        },
    )

    response = auth_client.get(f"/api/games/{seed_game.id}/library")

    [item] = response.json()
    assert item["isOnSale"] is True
    assert item["salePriceAmount"] == 19.99
    assert item["saleShopName"] == "PlayStation Store"
    assert item["saleCut"] == 50


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
