from app.models.catalog import Game, GameCategory
from app.models.hardware import AccessoryDeviceLink, UserAccessory, UserDevice
from app.models.library import LibraryItem, LibraryStatus


def test_duplicate_library_items_requires_auth(client):
    response = client.get("/api/insights/duplicate-library-items")

    assert response.status_code == 401


def test_no_duplicates_when_library_items_differ(auth_client, db_session, seed_game, seed_platform):
    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=None, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get("/api/insights/duplicate-library-items")

    assert response.status_code == 200
    assert response.json() == []


def test_detects_duplicate_library_items(auth_client, db_session, seed_game, seed_platform, seed_region):
    db_session.add(
        LibraryItem(
            game_id=seed_game.id, platform_id=seed_platform.id, region_id=seed_region.id, status=LibraryStatus.OWNED
        )
    )
    db_session.add(
        LibraryItem(
            game_id=seed_game.id, platform_id=seed_platform.id, region_id=seed_region.id, status=LibraryStatus.OWNED
        )
    )
    db_session.commit()

    response = auth_client.get("/api/insights/duplicate-library-items")

    assert response.status_code == 200
    [group] = response.json()
    assert group["gameId"] == seed_game.id
    assert group["gameName"] == seed_game.name
    assert len(group["items"]) == 2


def test_duplicate_detection_treats_null_platform_as_equal(auth_client, db_session, seed_game):
    db_session.add(LibraryItem(game_id=seed_game.id, status=LibraryStatus.WISHLIST))
    db_session.add(LibraryItem(game_id=seed_game.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    response = auth_client.get("/api/insights/duplicate-library-items")

    [group] = response.json()
    assert len(group["items"]) == 2


def test_missing_dlc_requires_auth(client):
    response = client.get("/api/insights/missing-dlc")

    assert response.status_code == 401


def test_missing_dlc_empty_when_nothing_owned(auth_client, seed_game):
    response = auth_client.get("/api/insights/missing-dlc")

    assert response.status_code == 200
    assert response.json() == []


def test_missing_dlc_flags_unowned_addon_of_owned_game(auth_client, db_session, seed_game, seed_platform):
    addon = Game(igdb_id=9001, name="Test Game DLC", category=GameCategory.DLC_ADDON, parent_game_id=seed_game.id)
    db_session.add(addon)
    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get("/api/insights/missing-dlc")

    assert response.status_code == 200
    [entry] = response.json()
    assert entry["game"]["id"] == seed_game.id
    assert [a["id"] for a in entry["missingAddons"]] == [addon.id]


def test_missing_dlc_excludes_addon_the_user_already_owns(auth_client, db_session, seed_game, seed_platform):
    addon = Game(igdb_id=9002, name="Owned DLC", category=GameCategory.DLC_ADDON, parent_game_id=seed_game.id)
    db_session.add(addon)
    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()
    db_session.add(LibraryItem(game_id=addon.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get("/api/insights/missing-dlc")

    assert response.json() == []


def test_missing_dlc_ignores_unowned_base_game(auth_client, db_session, seed_game):
    addon = Game(igdb_id=9003, name="DLC of unowned game", category=GameCategory.DLC_ADDON, parent_game_id=seed_game.id)
    db_session.add(addon)
    db_session.commit()

    response = auth_client.get("/api/insights/missing-dlc")

    assert response.json() == []


def test_missing_dlc_excludes_non_dlc_like_categories(auth_client, db_session, seed_game, seed_platform):
    bundle = Game(igdb_id=9004, name="GOTY Edition", category=GameCategory.BUNDLE, parent_game_id=seed_game.id)
    standalone = Game(
        igdb_id=9005, name="Standalone Spinoff", category=GameCategory.STANDALONE_EXPANSION, parent_game_id=seed_game.id
    )
    uncategorized = Game(igdb_id=9006, name="Mystery Update", category=None, parent_game_id=seed_game.id)
    db_session.add_all([bundle, standalone, uncategorized])
    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get("/api/insights/missing-dlc")

    assert response.json() == []


def test_accessories_without_owned_hardware_requires_auth(client):
    response = client.get("/api/insights/accessories-without-owned-hardware")

    assert response.status_code == 401


def test_accessories_without_owned_hardware_empty_when_nothing_owned(auth_client):
    response = auth_client.get("/api/insights/accessories-without-owned-hardware")

    assert response.status_code == 200
    assert response.json() == []


def test_accessories_without_owned_hardware_flags_accessory_with_no_links(
    auth_client, db_session, seed_accessory
):
    db_session.add(UserAccessory(accessory_id=seed_accessory.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get("/api/insights/accessories-without-owned-hardware")

    assert response.status_code == 200
    [item] = response.json()
    assert item["id"] == seed_accessory.id


def test_accessories_without_owned_hardware_flags_accessory_linked_to_unowned_device(
    auth_client, db_session, seed_accessory, seed_device
):
    db_session.add(UserAccessory(accessory_id=seed_accessory.id, status=LibraryStatus.OWNED))
    db_session.add(AccessoryDeviceLink(accessory_id=seed_accessory.id, device_id=seed_device.id))
    db_session.commit()

    response = auth_client.get("/api/insights/accessories-without-owned-hardware")

    [item] = response.json()
    assert item["id"] == seed_accessory.id


def test_accessories_without_owned_hardware_excludes_accessory_linked_to_owned_device(
    auth_client, db_session, seed_accessory, seed_device
):
    db_session.add(UserAccessory(accessory_id=seed_accessory.id, status=LibraryStatus.OWNED))
    db_session.add(AccessoryDeviceLink(accessory_id=seed_accessory.id, device_id=seed_device.id))
    db_session.add(UserDevice(device_id=seed_device.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get("/api/insights/accessories-without-owned-hardware")

    assert response.json() == []


def test_accessories_without_owned_hardware_excludes_wishlisted_accessory(auth_client, db_session, seed_accessory):
    db_session.add(UserAccessory(accessory_id=seed_accessory.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    response = auth_client.get("/api/insights/accessories-without-owned-hardware")

    assert response.json() == []
