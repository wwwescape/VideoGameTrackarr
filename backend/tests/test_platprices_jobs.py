import pytest

from app.core.config import get_settings
from app.models.catalog import Game, GameCategory
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.repositories import platprices_repository
from app.services import platprices_jobs
from app.services.platprices_client import PlatPricesClient, PlatPricesDeal, PlatPricesGameData, PlatPricesHistoricalLow


def _configure_platprices(monkeypatch):
    # The repo-root .env may have real PLATPRICES_API_KEY/PLATPRICES_REGION values for local
    # dev use — pin both explicitly, same reasoning as test_itad_jobs.py's equivalent.
    monkeypatch.setattr(get_settings(), "platprices_api_key", "test-platprices-key")
    monkeypatch.setattr(get_settings(), "platprices_region", "US")
    monkeypatch.setattr(platprices_jobs, "_PACE_DELAY_SECONDS", 0)


def _seed_wishlisted_ps5_game(db_session, igdb_id: int, name: str, seed_platform) -> Game:
    # conftest's seed_platform is "Sony PlayStation 5" (slug "ps5") — genuinely PlatPrices-
    # eligible, unlike the confusingly-similarly-named seed_pc_platform used elsewhere.
    game = Game(igdb_id=igdb_id, name=name, slug=name.lower().replace(" ", "-"), category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    db_session.add(
        LibraryItem(
            game_id=game.id, platform_id=seed_platform.id, format=MediaFormat.DIGITAL, status=LibraryStatus.WISHLIST
        )
    )
    db_session.commit()
    return game


def test_run_requires_platprices_configuration(db_session, monkeypatch):
    monkeypatch.setattr(platprices_jobs, "_PACE_DELAY_SECONDS", 0)
    monkeypatch.setattr(get_settings(), "platprices_api_key", None)

    with pytest.raises(platprices_jobs.PlatPricesNotConfiguredError):
        platprices_jobs.run(lambda: db_session)


def test_run_skips_a_wishlisted_game_on_a_non_ps_platform(db_session, seed_pc_platform, monkeypatch):
    """seed_pc_platform (slug "win") isn't PS4/PS5 — PlatPrices doesn't cover it — so the job
    must never even attempt a lookup for a game only wishlisted there."""
    game = Game(igdb_id=1, name="PC Only Game", slug="pc-only-game", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    db_session.add(
        LibraryItem(
            game_id=game.id,
            platform_id=seed_pc_platform.id,
            format=MediaFormat.DIGITAL,
            status=LibraryStatus.WISHLIST,
        )
    )
    db_session.commit()
    _configure_platprices(monkeypatch)

    search_calls = []

    async def fake_search(self, title, region):
        search_calls.append(title)
        return None

    monkeypatch.setattr(PlatPricesClient, "search_game", fake_search)

    result = platprices_jobs.run(lambda: db_session)

    assert result["total"] == 0
    assert search_calls == []


def test_run_matches_and_caches_price_for_a_wishlisted_ps5_game(db_session, seed_platform, monkeypatch):
    game = _seed_wishlisted_ps5_game(db_session, igdb_id=233, name="Ghost of Tsushima", seed_platform=seed_platform)
    game_id = game.id  # captured before run() below closes db_session
    _configure_platprices(monkeypatch)

    async def fake_search(self, title, region):
        assert title == "Ghost of Tsushima"
        assert region == "US"
        return "222"

    async def fake_get_price_data(self, ppids, region):
        assert ppids == ["222"]
        assert region == "US"
        return {
            "222": PlatPricesGameData(
                current_deal=PlatPricesDeal(
                    shop_name="PlayStation Store", price_amount=29.99, price_currency="USD", cut=40
                ),
                historical_low=PlatPricesHistoricalLow(
                    shop_name="PlayStation Store", price_amount=19.99, price_currency="USD"
                ),
            )
        }

    monkeypatch.setattr(PlatPricesClient, "search_game", fake_search)
    monkeypatch.setattr(PlatPricesClient, "get_price_data", fake_get_price_data)

    result = platprices_jobs.run(lambda: db_session)

    assert result == {"total": 1, "succeeded": 1, "failed": 0, "failures": []}
    cache = platprices_repository.get_cache(db_session, game_id)
    assert cache.ppid == "222"
    assert cache.current_price_amount == 29.99
    assert cache.current_shop_name == "PlayStation Store"
    assert cache.historical_low_amount == 19.99


def test_run_does_not_refetch_a_match_that_already_exists(db_session, seed_platform, monkeypatch):
    game = _seed_wishlisted_ps5_game(db_session, igdb_id=233, name="Ghost of Tsushima", seed_platform=seed_platform)
    cache = platprices_repository.get_or_create_cache(db_session, game.id)
    platprices_repository.set_ppid(db_session, cache, "already-matched")
    db_session.commit()
    _configure_platprices(monkeypatch)

    search_calls = []

    async def fake_search(self, title, region):
        search_calls.append(title)
        return "should-not-be-used"

    async def fake_get_price_data(self, ppids, region):
        assert ppids == ["already-matched"]
        return {}

    monkeypatch.setattr(PlatPricesClient, "search_game", fake_search)
    monkeypatch.setattr(PlatPricesClient, "get_price_data", fake_get_price_data)

    platprices_jobs.run(lambda: db_session)

    assert search_calls == []  # already matched, no re-search


def test_run_isolates_a_per_game_search_failure(db_session, seed_platform, monkeypatch):
    _seed_wishlisted_ps5_game(db_session, igdb_id=1, name="Good Game", seed_platform=seed_platform)
    bad_game = _seed_wishlisted_ps5_game(db_session, igdb_id=2, name="Bad Game", seed_platform=seed_platform)

    _configure_platprices(monkeypatch)

    async def fake_search(self, title, region):
        if title == "Bad Game":
            raise RuntimeError("PlatPrices request failed")
        return None  # unmatched is fine for "Good Game" — just proves it isn't skipped

    async def fake_get_price_data(self, ppids, region):
        return {}

    monkeypatch.setattr(PlatPricesClient, "search_game", fake_search)
    monkeypatch.setattr(PlatPricesClient, "get_price_data", fake_get_price_data)

    result = platprices_jobs.run(lambda: db_session)

    assert result["total"] == 2
    assert result["succeeded"] == 1
    assert result["failed"] == 1
    assert result["failures"] == [{"gameId": bad_game.id, "gameName": "Bad Game", "error": "PlatPrices request failed"}]


def test_run_deduplicates_a_game_wishlisted_via_multiple_library_items(
    db_session, seed_platform, seed_region, monkeypatch
):
    game = Game(igdb_id=233, name="Ghost of Tsushima", slug="ghost-of-tsushima", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    db_session.add(
        LibraryItem(
            game_id=game.id,
            platform_id=seed_platform.id,
            format=MediaFormat.DIGITAL,
            status=LibraryStatus.WISHLIST,
        )
    )
    db_session.add(
        LibraryItem(
            game_id=game.id,
            platform_id=seed_platform.id,
            format=MediaFormat.DIGITAL,
            region_id=seed_region.id,
            status=LibraryStatus.WISHLIST,
        )
    )
    db_session.commit()
    _configure_platprices(monkeypatch)

    search_calls = []

    async def fake_search(self, title, region):
        search_calls.append(title)
        return None

    monkeypatch.setattr(PlatPricesClient, "search_game", fake_search)

    result = platprices_jobs.run(lambda: db_session)

    assert result["total"] == 1  # one game, not two rows
    assert search_calls == ["Ghost of Tsushima"]
