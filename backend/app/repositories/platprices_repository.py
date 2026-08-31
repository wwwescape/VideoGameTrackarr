from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.catalog import Game, Platform
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.models.platprices import PlatPricesCache
from app.services.platprices_client import PlatPricesDeal, PlatPricesHistoricalLow

# Must stay in sync with platprices_service.PLATPRICES_ELIGIBLE_PLATFORM_SLUGS — kept as a
# separate local constant rather than importing it, since this repository doesn't otherwise
# depend on the service layer.
_ELIGIBLE_PLATFORM_SLUGS = {"ps4", "ps5"}


def get_cache(db: Session, game_id: int) -> PlatPricesCache | None:
    return db.scalars(select(PlatPricesCache).where(PlatPricesCache.game_id == game_id)).first()


def get_or_create_cache(db: Session, game_id: int) -> PlatPricesCache:
    cache = get_cache(db, game_id)
    if cache is None:
        cache = PlatPricesCache(game_id=game_id)
        db.add(cache)
        db.flush()
    return cache


def list_distinct_wishlisted_games(db: Session) -> list[Game]:
    """Every game with at least one WISHLIST LibraryItem that's actually PlatPrices-eligible
    (digital format, PS4/PS5 platform) — deduplicated. Unlike itad_repository's equivalent
    (which matches every wishlisted game regardless of platform, since ITAD's quota is
    generous), PlatPrices' free tier is only 1,000 requests/month, so matching spend must
    stay proportional to actual PS wishlist size, not total wishlist size."""
    stmt = (
        select(Game)
        .join(LibraryItem, LibraryItem.game_id == Game.id)
        .join(Platform, Platform.id == LibraryItem.platform_id)
        .where(
            LibraryItem.status == LibraryStatus.WISHLIST,
            LibraryItem.format == MediaFormat.DIGITAL,
            Platform.slug.in_(_ELIGIBLE_PLATFORM_SLUGS),
        )
        .distinct()
    )
    return list(db.scalars(stmt))


def set_ppid(db: Session, cache: PlatPricesCache, ppid: str | None) -> PlatPricesCache:
    cache.ppid = ppid
    cache.checked_at = datetime.now(UTC)
    db.flush()
    return cache


def update_price_data(
    db: Session, cache: PlatPricesCache, deal: PlatPricesDeal | None, historical: PlatPricesHistoricalLow | None
) -> PlatPricesCache:
    cache.current_price_amount = deal.price_amount if deal else None
    cache.current_price_currency = deal.price_currency if deal else None
    cache.current_shop_name = deal.shop_name if deal else None
    cache.current_cut = deal.cut if deal else None
    cache.historical_low_amount = historical.price_amount if historical else None
    cache.historical_low_currency = historical.price_currency if historical else None
    cache.historical_low_shop_name = historical.shop_name if historical else None
    cache.historical_low_at = None
    cache.checked_at = datetime.now(UTC)
    db.flush()
    return cache
