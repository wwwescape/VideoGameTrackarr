import pytest

from app.core.config import get_settings
from app.models.catalog import Game, GameCategory
from app.models.library import LibraryItem, LibraryStatus
from app.repositories import itad_repository
from app.services import itad_jobs
from app.services.itad_client import ItadClient, ItadDeal, ItadHistoricalLow


def _configure_itad(monkeypatch):
    # The repo-root .env may have real ITAD_API_KEY/ITAD_COUNTRY values for local dev use —
    # pin both explicitly so this test's behavior doesn't depend on whatever's in .env.
    monkeypatch.setattr(get_settings(), "itad_api_key", "test-itad-key")
    monkeypatch.setattr(get_settings(), "itad_country", "US")
    monkeypatch.setattr(itad_jobs, "_PACE_DELAY_SECONDS", 0)


def _seed_wishlisted_game(db_session, igdb_id: int, name: str, seed_platform) -> Game:
    game = Game(igdb_id=igdb_id, name=name, slug=name.lower().replace(" ", "-"), category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    db_session.add(LibraryItem(game_id=game.id, platform_id=seed_platform.id, status=LibraryStatus.WISHLIST))
    db_session.commit()
    return game


def test_run_requires_itad_configuration(db_session, monkeypatch):
    monkeypatch.setattr(itad_jobs, "_PACE_DELAY_SECONDS", 0)
    # The repo-root .env may have a real ITAD_API_KEY for local dev use — override it
    # explicitly rather than relying on it being unset, same reasoning as
    # test_itad_client.py's equivalent credentials test.
    monkeypatch.setattr(get_settings(), "itad_api_key", None)

    with pytest.raises(itad_jobs.ItadNotConfiguredError):
        itad_jobs.run(lambda: db_session)


def test_run_matches_and_caches_price_for_a_wishlisted_game(db_session, seed_platform, monkeypatch):
    game = _seed_wishlisted_game(db_session, igdb_id=233, name="Half-Life 2", seed_platform=seed_platform)
    game_id = game.id  # captured before run() below closes db_session
    _configure_itad(monkeypatch)

    async def fake_lookup(self, title):
        assert title == "Half-Life 2"
        return "itad-id-1"

    async def fake_get_prices(self, itad_ids, country):
        assert itad_ids == ["itad-id-1"]
        assert country == "US"
        return {"itad-id-1": ItadDeal(shop_name="GOG", price_amount=14.99, price_currency="USD", cut=40)}

    async def fake_get_historical_low(self, itad_ids, country):
        return {
            "itad-id-1": ItadHistoricalLow(
                shop_name="Steam", price_amount=9.99, price_currency="USD", cut=75, achieved_at=None
            )
        }

    monkeypatch.setattr(ItadClient, "lookup_game_id", fake_lookup)
    monkeypatch.setattr(ItadClient, "get_prices", fake_get_prices)
    monkeypatch.setattr(ItadClient, "get_historical_low", fake_get_historical_low)

    result = itad_jobs.run(lambda: db_session)

    assert result == {"total": 1, "succeeded": 1, "failed": 0, "failures": []}
    cache = itad_repository.get_cache(db_session, game_id)
    assert cache.itad_game_id == "itad-id-1"
    assert cache.current_price_amount == 14.99
    assert cache.current_shop_name == "GOG"
    assert cache.historical_low_amount == 9.99


def test_run_skips_games_with_no_wishlist_items(db_session, seed_platform, monkeypatch):
    game = Game(igdb_id=1, name="Owned Only", slug="owned-only", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    db_session.add(LibraryItem(game_id=game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()
    _configure_itad(monkeypatch)

    lookup_calls = []

    async def fake_lookup(self, title):
        lookup_calls.append(title)
        return None

    monkeypatch.setattr(ItadClient, "lookup_game_id", fake_lookup)

    result = itad_jobs.run(lambda: db_session)

    assert result["total"] == 0
    assert lookup_calls == []


def test_run_does_not_refetch_a_match_that_already_exists(db_session, seed_platform, monkeypatch):
    game = _seed_wishlisted_game(db_session, igdb_id=233, name="Half-Life 2", seed_platform=seed_platform)
    db_session.add(itad_jobs.itad_repository.get_or_create_cache(db_session, game.id))
    cache = itad_jobs.itad_repository.get_cache(db_session, game.id)
    itad_jobs.itad_repository.set_itad_id(db_session, cache, "already-matched")
    db_session.commit()
    _configure_itad(monkeypatch)

    lookup_calls = []

    async def fake_lookup(self, title):
        lookup_calls.append(title)
        return "should-not-be-used"

    async def fake_get_prices(self, itad_ids, country):
        assert itad_ids == ["already-matched"]
        return {}

    async def fake_get_historical_low(self, itad_ids, country):
        return {}

    monkeypatch.setattr(ItadClient, "lookup_game_id", fake_lookup)
    monkeypatch.setattr(ItadClient, "get_prices", fake_get_prices)
    monkeypatch.setattr(ItadClient, "get_historical_low", fake_get_historical_low)

    itad_jobs.run(lambda: db_session)

    assert lookup_calls == []  # already matched, no re-lookup


def test_run_isolates_a_per_game_lookup_failure(db_session, seed_platform, monkeypatch):
    _seed_wishlisted_game(db_session, igdb_id=1, name="Good Game", seed_platform=seed_platform)
    bad_game = _seed_wishlisted_game(db_session, igdb_id=2, name="Bad Game", seed_platform=seed_platform)

    _configure_itad(monkeypatch)

    async def fake_lookup(self, title):
        if title == "Bad Game":
            raise RuntimeError("ITAD request failed")
        return None  # unmatched is fine for "Good Game" — just proves it isn't skipped

    async def fake_get_prices(self, itad_ids, country):
        return {}

    async def fake_get_historical_low(self, itad_ids, country):
        return {}

    monkeypatch.setattr(ItadClient, "lookup_game_id", fake_lookup)
    monkeypatch.setattr(ItadClient, "get_prices", fake_get_prices)
    monkeypatch.setattr(ItadClient, "get_historical_low", fake_get_historical_low)

    result = itad_jobs.run(lambda: db_session)

    assert result["total"] == 2
    assert result["succeeded"] == 1
    assert result["failed"] == 1
    assert result["failures"] == [{"gameId": bad_game.id, "gameName": "Bad Game", "error": "ITAD request failed"}]


def test_run_deduplicates_a_game_wishlisted_via_multiple_library_items(
    db_session, seed_platform, seed_region, monkeypatch
):
    game = Game(igdb_id=233, name="Half-Life 2", slug="half-life-2", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    db_session.add(LibraryItem(game_id=game.id, platform_id=seed_platform.id, status=LibraryStatus.WISHLIST))
    db_session.add(
        LibraryItem(
            game_id=game.id, platform_id=seed_platform.id, region_id=seed_region.id, status=LibraryStatus.WISHLIST
        )
    )
    db_session.commit()
    _configure_itad(monkeypatch)

    lookup_calls = []

    async def fake_lookup(self, title):
        lookup_calls.append(title)
        return None

    monkeypatch.setattr(ItadClient, "lookup_game_id", fake_lookup)

    result = itad_jobs.run(lambda: db_session)

    assert result["total"] == 1  # one game, not two rows
    assert lookup_calls == ["Half-Life 2"]
