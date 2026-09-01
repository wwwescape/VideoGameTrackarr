from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.catalog import Game
from app.models.itad import ItadPriceCache
from app.models.library import LibraryItem, LibraryStatus
from app.services.itad_client import ItadDeal, ItadHistoricalLow


def get_cache(db: Session, game_id: int) -> ItadPriceCache | None:
    return db.scalars(select(ItadPriceCache).where(ItadPriceCache.game_id == game_id)).first()


def get_or_create_cache(db: Session, game_id: int) -> ItadPriceCache:
    cache = get_cache(db, game_id)
    if cache is None:
        cache = ItadPriceCache(game_id=game_id)
        db.add(cache)
        db.flush()
    return cache


def list_distinct_wishlisted_games(db: Session) -> list[Game]:
    """Every game with at least one WISHLIST, track_for_sales-opted-in LibraryItem —
    deduplicated, since the same game can be wishlisted via more than one row (different
    platforms/regions), but price only needs fetching once per game."""
    stmt = (
        select(Game)
        .join(LibraryItem, LibraryItem.game_id == Game.id)
        .where(LibraryItem.status == LibraryStatus.WISHLIST, LibraryItem.track_for_sales.is_(True))
        .distinct()
    )
    return list(db.scalars(stmt))


def set_itad_id(db: Session, cache: ItadPriceCache, itad_game_id: str | None) -> ItadPriceCache:
    # A None result means this attempt found no exact title match — mark it ignored so future
    # job runs stop re-searching it forever; a real id always clears any prior ignored flag
    # (covers the case where a manual Retry now finds a match on a re-attempt).
    cache.itad_game_id = itad_game_id
    cache.ignored = itad_game_id is None
    cache.checked_at = datetime.now(UTC)
    db.flush()
    return cache


def set_ignored(db: Session, cache: ItadPriceCache, ignored: bool) -> ItadPriceCache:
    cache.ignored = ignored
    db.flush()
    return cache


def list_ignored(db: Session) -> list[ItadPriceCache]:
    stmt = (
        select(ItadPriceCache)
        .options(joinedload(ItadPriceCache.game))
        .where(ItadPriceCache.ignored.is_(True))
    )
    return list(db.scalars(stmt))


def update_price_data(
    db: Session, cache: ItadPriceCache, deal: ItadDeal | None, historical: ItadHistoricalLow | None
) -> ItadPriceCache:
    cache.current_price_amount = deal.price_amount if deal else None
    cache.current_price_currency = deal.price_currency if deal else None
    cache.current_shop_name = deal.shop_name if deal else None
    cache.current_cut = deal.cut if deal else None
    cache.historical_low_amount = historical.price_amount if historical else None
    cache.historical_low_currency = historical.price_currency if historical else None
    cache.historical_low_shop_name = historical.shop_name if historical else None
    cache.historical_low_at = historical.achieved_at if historical else None
    cache.checked_at = datetime.now(UTC)
    db.flush()
    return cache
