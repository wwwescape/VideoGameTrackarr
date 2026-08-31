from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.itad import ItadPriceCache
from app.models.library import LibraryItem, LibraryStatus, MediaFormat

# ITAD only tracks digital storefronts for Windows, Linux, Mac, and Android (IGDB slugs) —
# a wishlist row for any other platform, or a non-digital format, can't actually be bought
# through a deal ITAD reports, so it must never be flagged "on sale" even if the same game
# happens to be discounted on a platform this particular row isn't tracking.
ITAD_ELIGIBLE_PLATFORM_SLUGS = {"win", "linux", "mac", "android"}


def is_library_item_itad_eligible(item: LibraryItem) -> bool:
    return (
        item.format == MediaFormat.DIGITAL
        and item.platform is not None
        and item.platform.slug in ITAD_ELIGIBLE_PLATFORM_SLUGS
    )


@dataclass
class OnSaleItem:
    library_item: LibraryItem
    cache: ItadPriceCache
    is_target_hit: bool


def list_on_sale_items(db: Session) -> list[OnSaleItem]:
    """Every wishlisted, ITAD-eligible row ITAD currently has a discount for — visibility
    isn't gated on having a target_price set; a target just flags a row as "hit" and sorts
    it first. Rows with no ITAD match, not currently discounted, or not ITAD-eligible (see
    is_library_item_itad_eligible) are simply excluded (a silent no-op, not an error)."""
    stmt = (
        select(LibraryItem, ItadPriceCache)
        .join(ItadPriceCache, ItadPriceCache.game_id == LibraryItem.game_id)
        .options(joinedload(LibraryItem.game), joinedload(LibraryItem.platform))
        .where(
            LibraryItem.status == LibraryStatus.WISHLIST,
            ItadPriceCache.current_price_amount.is_not(None),
        )
    )
    rows = db.execute(stmt).all()

    items = [
        OnSaleItem(
            library_item=item,
            cache=cache,
            is_target_hit=item.target_price is not None and cache.current_price_amount <= item.target_price,
        )
        for item, cache in rows
        if is_library_item_itad_eligible(item)
    ]
    items.sort(key=lambda entry: (not entry.is_target_hit, -(entry.cache.current_cut or 0)))
    return items
