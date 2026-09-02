from app.models.catalog import Game, GameCategory
from app.models.itad import ItadPriceCache
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.models.platprices import PlatPricesCache


def test_list_ignored_requires_auth(client):
    response = client.get("/api/sales-tracking/ignored")

    assert response.status_code == 401


def test_retry_ignored_requires_auth(client):
    response = client.post("/api/sales-tracking/ignored/itad/1/retry")

    assert response.status_code == 401


def test_list_ignored_empty_when_nothing_ignored(auth_client):
    response = auth_client.get("/api/sales-tracking/ignored")

    assert response.status_code == 200
    assert response.json() == []


def test_list_ignored_excludes_a_matched_itad_row(auth_client, db_session, seed_game):
    db_session.add(ItadPriceCache(game_id=seed_game.id, itad_game_id="itad-1", ignored=False))
    db_session.commit()

    response = auth_client.get("/api/sales-tracking/ignored")

    assert response.json() == []


def test_list_ignored_includes_an_ignored_itad_row(auth_client, db_session, seed_game):
    db_session.add(ItadPriceCache(game_id=seed_game.id, itad_game_id=None, ignored=True))
    db_session.commit()

    response = auth_client.get("/api/sales-tracking/ignored")

    assert response.status_code == 200
    [item] = response.json()
    assert item["provider"] == "itad"
    assert item["gameId"] == seed_game.id
    assert item["gameName"] == seed_game.name
    assert item["gameSlug"] == seed_game.slug


def test_list_ignored_includes_an_ignored_platprices_row(auth_client, db_session, seed_game):
    db_session.add(PlatPricesCache(game_id=seed_game.id, ppid=None, ignored=True))
    db_session.commit()

    response = auth_client.get("/api/sales-tracking/ignored")

    assert response.status_code == 200
    [item] = response.json()
    assert item["provider"] == "platprices"
    assert item["gameId"] == seed_game.id


def test_list_ignored_merges_both_providers_sorted_by_name(auth_client, db_session):
    zebra = Game(igdb_id=1, name="Zebra Quest", slug="zebra-quest", category=GameCategory.MAIN_GAME)
    apple = Game(igdb_id=2, name="Apple Adventure", slug="apple-adventure", category=GameCategory.MAIN_GAME)
    db_session.add(zebra)
    db_session.add(apple)
    db_session.commit()
    db_session.add(ItadPriceCache(game_id=zebra.id, itad_game_id=None, ignored=True))
    db_session.add(PlatPricesCache(game_id=apple.id, ppid=None, ignored=True))
    db_session.commit()

    response = auth_client.get("/api/sales-tracking/ignored")

    assert response.status_code == 200
    body = response.json()
    assert [item["gameName"] for item in body] == ["Apple Adventure", "Zebra Quest"]
    assert [item["provider"] for item in body] == ["platprices", "itad"]


def test_retry_itad_clears_the_ignored_flag(auth_client, db_session, seed_game):
    db_session.add(ItadPriceCache(game_id=seed_game.id, itad_game_id=None, ignored=True))
    db_session.commit()

    response = auth_client.post(f"/api/sales-tracking/ignored/itad/{seed_game.id}/retry")

    assert response.status_code == 204
    cache = db_session.query(ItadPriceCache).filter(ItadPriceCache.game_id == seed_game.id).one()
    assert cache.ignored is False

    follow_up = auth_client.get("/api/sales-tracking/ignored")
    assert follow_up.json() == []


def test_retry_platprices_clears_the_ignored_flag(auth_client, db_session, seed_game):
    db_session.add(PlatPricesCache(game_id=seed_game.id, ppid=None, ignored=True))
    db_session.commit()

    response = auth_client.post(f"/api/sales-tracking/ignored/platprices/{seed_game.id}/retry")

    assert response.status_code == 204
    cache = db_session.query(PlatPricesCache).filter(PlatPricesCache.game_id == seed_game.id).one()
    assert cache.ignored is False


def test_retry_404s_for_a_nonexistent_cache_row(auth_client, seed_game):
    response = auth_client.post(f"/api/sales-tracking/ignored/itad/{seed_game.id}/retry")

    assert response.status_code == 404


def test_retry_404s_for_a_row_that_is_not_ignored(auth_client, db_session, seed_game):
    db_session.add(ItadPriceCache(game_id=seed_game.id, itad_game_id="itad-1", ignored=False))
    db_session.commit()

    response = auth_client.post(f"/api/sales-tracking/ignored/itad/{seed_game.id}/retry")

    assert response.status_code == 404


def test_retry_rejects_an_unknown_provider(auth_client, seed_game):
    response = auth_client.post(f"/api/sales-tracking/ignored/steam/{seed_game.id}/retry")

    assert response.status_code == 422


def test_list_tracked_requires_auth(client):
    response = client.get("/api/sales-tracking/tracked")

    assert response.status_code == 401


def test_untrack_requires_auth(client):
    response = client.post("/api/sales-tracking/tracked/1/untrack")

    assert response.status_code == 401


def test_list_tracked_empty_when_nothing_tracked(auth_client):
    response = auth_client.get("/api/sales-tracking/tracked")

    assert response.status_code == 200
    assert response.json() == []


def test_list_tracked_excludes_an_owned_item(auth_client, db_session, seed_game, seed_pc_platform):
    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            platform_id=seed_pc_platform.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.DIGITAL,
            track_for_sales=True,
        )
    )
    db_session.commit()

    response = auth_client.get("/api/sales-tracking/tracked")

    assert response.json() == []


def test_list_tracked_excludes_a_wishlist_item_with_tracking_off(auth_client, db_session, seed_game, seed_pc_platform):
    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            platform_id=seed_pc_platform.id,
            status=LibraryStatus.WISHLIST,
            format=MediaFormat.DIGITAL,
            track_for_sales=False,
        )
    )
    db_session.commit()

    response = auth_client.get("/api/sales-tracking/tracked")

    assert response.json() == []


def test_list_tracked_includes_a_tracked_wishlist_item(auth_client, db_session, seed_game, seed_pc_platform):
    item = LibraryItem(
        game_id=seed_game.id,
        platform_id=seed_pc_platform.id,
        status=LibraryStatus.WISHLIST,
        format=MediaFormat.DIGITAL,
        digital_storefront="Steam",
        target_price=19.99,
        track_for_sales=True,
    )
    db_session.add(item)
    db_session.commit()

    response = auth_client.get("/api/sales-tracking/tracked")

    assert response.status_code == 200
    [row] = response.json()
    assert row["libraryItemId"] == item.id
    assert row["gameId"] == seed_game.id
    assert row["gameName"] == seed_game.name
    assert row["platformName"] == seed_pc_platform.name
    assert row["format"] == "digital"
    assert row["digitalStorefront"] == "Steam"
    assert row["targetPrice"] == 19.99


def test_list_tracked_sorted_by_game_name(auth_client, db_session, seed_pc_platform):
    zebra = Game(igdb_id=1, name="Zebra Quest", slug="zebra-quest", category=GameCategory.MAIN_GAME)
    apple = Game(igdb_id=2, name="Apple Adventure", slug="apple-adventure", category=GameCategory.MAIN_GAME)
    db_session.add(zebra)
    db_session.add(apple)
    db_session.commit()
    db_session.add(
        LibraryItem(
            game_id=zebra.id,
            platform_id=seed_pc_platform.id,
            status=LibraryStatus.WISHLIST,
            format=MediaFormat.DIGITAL,
            track_for_sales=True,
        )
    )
    db_session.add(
        LibraryItem(
            game_id=apple.id,
            platform_id=seed_pc_platform.id,
            status=LibraryStatus.WISHLIST,
            format=MediaFormat.DIGITAL,
            track_for_sales=True,
        )
    )
    db_session.commit()

    response = auth_client.get("/api/sales-tracking/tracked")

    assert [row["gameName"] for row in response.json()] == ["Apple Adventure", "Zebra Quest"]


def test_untrack_clears_track_for_sales_and_removes_it_from_the_list(
    auth_client, db_session, seed_game, seed_pc_platform
):
    item = LibraryItem(
        game_id=seed_game.id,
        platform_id=seed_pc_platform.id,
        status=LibraryStatus.WISHLIST,
        format=MediaFormat.DIGITAL,
        track_for_sales=True,
    )
    db_session.add(item)
    db_session.commit()
    item_id = item.id

    response = auth_client.post(f"/api/sales-tracking/tracked/{item_id}/untrack")

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.get(LibraryItem, item_id).track_for_sales is False

    follow_up = auth_client.get("/api/sales-tracking/tracked")
    assert follow_up.json() == []


def test_untrack_404s_for_a_nonexistent_library_item(auth_client):
    response = auth_client.post("/api/sales-tracking/tracked/999999/untrack")

    assert response.status_code == 404
