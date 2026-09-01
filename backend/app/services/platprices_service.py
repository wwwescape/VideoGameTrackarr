from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.catalog import Game
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.models.platprices import PlatPricesCache
from app.repositories import platprices_repository
from app.services.exceptions import NotFoundError

# PlatPrices only tracks the PlayStation Store — a wishlist row for any other platform, or a
# non-digital format, can't actually be bought through a deal it reports. Must stay in sync
# with platprices_repository._ELIGIBLE_PLATFORM_SLUGS.
PLATPRICES_ELIGIBLE_PLATFORM_SLUGS = {"ps4", "ps5"}


def is_library_item_platprices_eligible(item: LibraryItem) -> bool:
    return (
        item.format == MediaFormat.DIGITAL
        and item.platform is not None
        and item.platform.slug in PLATPRICES_ELIGIBLE_PLATFORM_SLUGS
    )


@dataclass
class PlatPricesOnSaleItem:
    library_item: LibraryItem
    cache: PlatPricesCache
    is_target_hit: bool


def list_on_sale_items(db: Session) -> list[PlatPricesOnSaleItem]:
    """Same shape as itad_service.list_on_sale_items — every wishlisted, track_for_sales-opted
    -in, PlatPrices-eligible row with a current discount, target-hit rows first then discount
    % descending. Gating on track_for_sales here too (not just the refresh job's candidate
    list) means turning tracking off hides a stale cached discount immediately."""
    stmt = (
        select(LibraryItem, PlatPricesCache)
        .join(PlatPricesCache, PlatPricesCache.game_id == LibraryItem.game_id)
        .options(joinedload(LibraryItem.game), joinedload(LibraryItem.platform))
        .where(
            LibraryItem.status == LibraryStatus.WISHLIST,
            LibraryItem.track_for_sales.is_(True),
            PlatPricesCache.current_price_amount.is_not(None),
        )
    )
    rows = db.execute(stmt).all()

    items = [
        PlatPricesOnSaleItem(
            library_item=item,
            cache=cache,
            is_target_hit=item.target_price is not None and cache.current_price_amount <= item.target_price,
        )
        for item, cache in rows
        if is_library_item_platprices_eligible(item)
    ]
    items.sort(key=lambda entry: (not entry.is_target_hit, -(entry.cache.current_cut or 0)))
    return items


@dataclass
class IgnoredSalesTitle:
    game: Game
    checked_at: datetime | None


def list_ignored_items(db: Session) -> list[IgnoredSalesTitle]:
    return [
        IgnoredSalesTitle(game=cache.game, checked_at=cache.checked_at)
        for cache in platprices_repository.list_ignored(db)
    ]


def retry_ignored_item(db: Session, game_id: int) -> None:
    cache = platprices_repository.get_cache(db, game_id)
    if cache is None or not cache.ignored:
        raise NotFoundError(f"No ignored PlatPrices entry for game {game_id}")
    platprices_repository.set_ignored(db, cache, False)
    db.commit()
