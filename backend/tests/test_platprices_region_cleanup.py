from app.core.config import get_settings
from app.models.catalog import Game, GameCategory
from app.repositories import platprices_repository
from app.services import platprices_service
from app.services.platprices_client import PlatPricesDeal, PlatPricesHistoricalLow


def _cached_game(db_session, igdb_id, name, region):
    game = Game(igdb_id=igdb_id, name=name, slug=name.lower().replace(" ", "-"), category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    cache = platprices_repository.get_or_create_cache(db_session, game.id)
    platprices_repository.set_ppid(db_session, cache, str(igdb_id))
    platprices_repository.update_price_data(
        db_session,
        cache,
        PlatPricesDeal(shop_name="PlayStation Store", price_amount=35.99, price_currency="USD", cut=40),
        PlatPricesHistoricalLow(shop_name="PlayStation Store", price_amount=29.99, price_currency="USD"),
        region=region,
    )
    db_session.commit()
    return game.id


def test_startup_clears_prices_from_another_region_or_an_unknown_one(db_session, monkeypatch):
    monkeypatch.setattr(get_settings(), "platprices_api_key", "test-platprices-key")
    monkeypatch.setattr(get_settings(), "platprices_region", "IN")
    from_us = _cached_game(db_session, 1, "Old US Price", "US")
    unknown = _cached_game(db_session, 2, "Before Regions Were Tracked", None)
    from_in = _cached_game(db_session, 3, "Current India Price", "IN")

    cleared = platprices_service.clear_prices_from_other_regions(db_session)

    assert cleared == 2
    for game_id in (from_us, unknown):
        cache = platprices_repository.get_cache(db_session, game_id)
        assert cache.current_price_amount is None
        assert cache.historical_low_amount is None
        assert cache.ppid is not None  # the match is kept; only the prices go
    kept = platprices_repository.get_cache(db_session, from_in)
    assert kept.current_price_amount == 35.99
    assert kept.region == "IN"


def test_startup_cleanup_does_nothing_when_platprices_is_not_configured(db_session, monkeypatch):
    monkeypatch.setattr(get_settings(), "platprices_api_key", None)
    monkeypatch.setattr(get_settings(), "platprices_region", "IN")
    game_id = _cached_game(db_session, 1, "Old US Price", "US")

    assert platprices_service.clear_prices_from_other_regions(db_session) == 0
    assert platprices_repository.get_cache(db_session, game_id).current_price_amount == 35.99
