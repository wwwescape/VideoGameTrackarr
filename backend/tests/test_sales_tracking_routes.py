from app.models.catalog import Game, GameCategory
from app.models.itad import ItadPriceCache
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
