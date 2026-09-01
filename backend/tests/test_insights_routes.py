from app.models.catalog import Game, GameCategory
from app.models.hardware import AccessoryDeviceLink, UserAccessory, UserDevice
from app.models.itad import ItadPriceCache
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.models.platprices import PlatPricesCache


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


def test_accessories_without_owned_hardware_flags_accessory_with_no_links(auth_client, db_session, seed_accessory):
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


def test_on_sale_requires_auth(client):
    response = client.get("/api/insights/on-sale")

    assert response.status_code == 401


def test_on_sale_empty_when_nothing_wishlisted(auth_client):
    response = auth_client.get("/api/insights/on-sale")

    assert response.status_code == 200
    assert response.json() == []


def test_on_sale_lists_a_wishlisted_game_with_a_current_discount(auth_client, db_session, seed_game, seed_pc_platform):
    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            status=LibraryStatus.WISHLIST,
            target_price=20.0,
            track_for_sales=True,
            format=MediaFormat.DIGITAL,
            platform_id=seed_pc_platform.id,
        )
    )
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

    response = auth_client.get("/api/insights/on-sale")

    assert response.status_code == 200
    [item] = response.json()
    assert item["game"]["id"] == seed_game.id
    assert item["currentPriceAmount"] == 14.99
    assert item["currentShopName"] == "GOG"
    assert item["targetPrice"] == 20.0
    assert item["isTargetHit"] is True


def test_on_sale_excludes_a_wishlist_row_with_tracking_off(auth_client, db_session, seed_game, seed_pc_platform):
    """Same shape as the "lists a wishlisted game" test above, but track_for_sales is left
    at its default False — proves a live cached discount stays hidden until the user opts in,
    not just that the refresh job skips fetching for it."""
    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            status=LibraryStatus.WISHLIST,
            format=MediaFormat.DIGITAL,
            platform_id=seed_pc_platform.id,
        )
    )
    db_session.add(
        ItadPriceCache(game_id=seed_game.id, itad_game_id="itad-1", current_price_amount=14.99, current_cut=40)
    )
    db_session.commit()

    response = auth_client.get("/api/insights/on-sale")

    assert response.json() == []


def test_on_sale_excludes_a_game_with_no_current_discount(auth_client, db_session, seed_game, seed_pc_platform):
    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            status=LibraryStatus.WISHLIST,
            format=MediaFormat.DIGITAL,
            platform_id=seed_pc_platform.id,
        )
    )
    db_session.add(ItadPriceCache(game_id=seed_game.id, itad_game_id="itad-1", current_price_amount=None))
    db_session.commit()

    response = auth_client.get("/api/insights/on-sale")

    assert response.json() == []


def test_on_sale_is_not_target_hit_when_current_price_is_above_target(
    auth_client, db_session, seed_game, seed_pc_platform
):
    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            status=LibraryStatus.WISHLIST,
            target_price=5.0,
            track_for_sales=True,
            format=MediaFormat.DIGITAL,
            platform_id=seed_pc_platform.id,
        )
    )
    db_session.add(
        ItadPriceCache(game_id=seed_game.id, itad_game_id="itad-1", current_price_amount=14.99, current_cut=10)
    )
    db_session.commit()

    response = auth_client.get("/api/insights/on-sale")

    [item] = response.json()
    assert item["isTargetHit"] is False


def test_on_sale_excludes_an_owned_games_discount(auth_client, db_session, seed_game, seed_pc_platform):
    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.DIGITAL,
            platform_id=seed_pc_platform.id,
        )
    )
    db_session.add(
        ItadPriceCache(game_id=seed_game.id, itad_game_id="itad-1", current_price_amount=14.99, current_cut=40)
    )
    db_session.commit()

    response = auth_client.get("/api/insights/on-sale")

    assert response.json() == []


def test_on_sale_excludes_a_wishlist_row_on_a_non_itad_platform(auth_client, db_session, seed_game, seed_platform):
    """seed_platform is PlayStation 5 (slug "ps5") — ITAD doesn't cover it, so even a real
    current discount on the game (e.g. via its Steam release) must not be shown against a
    console wishlist row that could never actually redeem that deal."""
    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            status=LibraryStatus.WISHLIST,
            format=MediaFormat.DIGITAL,
            platform_id=seed_platform.id,
        )
    )
    db_session.add(
        ItadPriceCache(game_id=seed_game.id, itad_game_id="itad-1", current_price_amount=14.99, current_cut=40)
    )
    db_session.commit()

    response = auth_client.get("/api/insights/on-sale")

    assert response.json() == []


def test_on_sale_excludes_a_physical_wishlist_row_even_on_an_itad_platform(
    auth_client, db_session, seed_game, seed_pc_platform
):
    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            status=LibraryStatus.WISHLIST,
            format=MediaFormat.PHYSICAL,
            platform_id=seed_pc_platform.id,
        )
    )
    db_session.add(
        ItadPriceCache(game_id=seed_game.id, itad_game_id="itad-1", current_price_amount=14.99, current_cut=40)
    )
    db_session.commit()

    response = auth_client.get("/api/insights/on-sale")

    assert response.json() == []


def test_on_sale_excludes_a_wishlist_row_with_no_platform_set(auth_client, db_session, seed_game):
    db_session.add(LibraryItem(game_id=seed_game.id, status=LibraryStatus.WISHLIST, format=MediaFormat.DIGITAL))
    db_session.add(
        ItadPriceCache(game_id=seed_game.id, itad_game_id="itad-1", current_price_amount=14.99, current_cut=40)
    )
    db_session.commit()

    response = auth_client.get("/api/insights/on-sale")

    assert response.json() == []


def test_on_sale_includes_a_wishlisted_ps5_game_with_a_current_discount(
    auth_client, db_session, seed_game, seed_platform
):
    # conftest's seed_platform is "Sony PlayStation 5" (slug "ps5").
    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            status=LibraryStatus.WISHLIST,
            format=MediaFormat.DIGITAL,
            platform_id=seed_platform.id,
            target_price=25.0,
            track_for_sales=True,
        )
    )
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

    response = auth_client.get("/api/insights/on-sale")

    assert response.status_code == 200
    [item] = response.json()
    assert item["game"]["id"] == seed_game.id
    assert item["currentPriceAmount"] == 19.99
    assert item["currentShopName"] == "PlayStation Store"
    assert item["isTargetHit"] is True


def test_on_sale_merges_itad_and_platprices_rows_sorted_by_discount(
    auth_client, db_session, seed_pc_platform, seed_platform
):
    pc_game = Game(igdb_id=1, name="PC Game", slug="pc-game", category=GameCategory.MAIN_GAME)
    ps_game = Game(igdb_id=2, name="PS Game", slug="ps-game", category=GameCategory.MAIN_GAME)
    db_session.add(pc_game)
    db_session.add(ps_game)
    db_session.commit()
    db_session.add(
        LibraryItem(
            game_id=pc_game.id,
            status=LibraryStatus.WISHLIST,
            format=MediaFormat.DIGITAL,
            platform_id=seed_pc_platform.id,
            track_for_sales=True,
        )
    )
    db_session.add(
        LibraryItem(
            game_id=ps_game.id,
            status=LibraryStatus.WISHLIST,
            format=MediaFormat.DIGITAL,
            platform_id=seed_platform.id,
            track_for_sales=True,
        )
    )
    db_session.add(ItadPriceCache(game_id=pc_game.id, itad_game_id="itad-1", current_price_amount=10.0, current_cut=20))
    db_session.add(PlatPricesCache(game_id=ps_game.id, ppid="222", current_price_amount=10.0, current_cut=70))
    db_session.commit()

    response = auth_client.get("/api/insights/on-sale")

    assert response.status_code == 200
    body = response.json()
    assert [item["game"]["id"] for item in body] == [ps_game.id, pc_game.id]  # 70% before 20%


def test_on_sale_excludes_a_wishlisted_ps5_physical_row_even_with_a_cached_discount(
    auth_client, db_session, seed_game, seed_platform
):
    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            status=LibraryStatus.WISHLIST,
            format=MediaFormat.PHYSICAL,
            platform_id=seed_platform.id,
        )
    )
    db_session.add(PlatPricesCache(game_id=seed_game.id, ppid="222", current_price_amount=19.99, current_cut=50))
    db_session.commit()

    response = auth_client.get("/api/insights/on-sale")

    assert response.json() == []
