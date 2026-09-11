from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.catalog import Game
from app.models.itad import ItadPriceCache
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.repositories import itad_repository, library_item_repository
from app.services import storefront_matching
from app.services.exceptions import NotFoundError

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
class MatchedItadDeal:
    """Duck-types the subset of ItadPriceCache's fields on_sale_item_from_orm reads, but
    holds the specific shop's deal that matches a row's own digital_storefront — not
    whichever shop ITAD happened to report as globally cheapest. Historical low stays the
    shared per-game value, since ITAD's historylow endpoint isn't broken out per shop."""

    current_price_amount: float
    current_price_currency: str | None
    current_shop_name: str | None
    current_cut: int | None
    historical_low_amount: float | None
    historical_low_currency: str | None
    historical_low_shop_name: str | None
    historical_low_at: datetime | None


@dataclass
class OnSaleItem:
    library_item: LibraryItem
    cache: MatchedItadDeal
    is_target_hit: bool


def list_on_sale_items(db: Session) -> list[OnSaleItem]:
    """Every wishlisted, track_for_sales-opted-in, ITAD-eligible row whose own tracked
    storefront (see storefront_matching.find_deal) currently has a discount — visibility
    isn't gated on having a target_price set; a target just flags a row as "hit" and sorts it
    first. Rows with tracking off, no ITAD match, not currently discounted on their own
    storefront, or not ITAD-eligible (see is_library_item_itad_eligible) are simply excluded
    (a silent no-op, not an error) — gating on track_for_sales here too (not just the refresh
    job's candidate list) means turning tracking off hides a stale cached discount
    immediately, rather than leaving it visible until the cache happens to go stale."""
    stmt = (
        select(LibraryItem, ItadPriceCache)
        .join(ItadPriceCache, ItadPriceCache.game_id == LibraryItem.game_id)
        .options(joinedload(LibraryItem.game), joinedload(LibraryItem.platform))
        .where(
            LibraryItem.status == LibraryStatus.WISHLIST,
            LibraryItem.track_for_sales.is_(True),
            # Coarse pre-filter only ("something's on sale somewhere") — the precise
            # per-storefront match happens below in Python via storefront_matching.find_deal.
            ItadPriceCache.current_price_amount.is_not(None),
        )
    )
    rows = db.execute(stmt).all()

    items: list[OnSaleItem] = []
    for item, cache in rows:
        if not is_library_item_itad_eligible(item):
            continue
        deal = storefront_matching.find_deal(cache, item.digital_storefront)
        if deal is None:
            continue
        matched = MatchedItadDeal(
            current_price_amount=deal.price_amount,
            current_price_currency=deal.price_currency,
            current_shop_name=deal.shop_name,
            current_cut=deal.cut,
            historical_low_amount=cache.historical_low_amount,
            historical_low_currency=cache.historical_low_currency,
            historical_low_shop_name=cache.historical_low_shop_name,
            historical_low_at=cache.historical_low_at,
        )
        items.append(
            OnSaleItem(
                library_item=item,
                cache=matched,
                is_target_hit=item.target_price is not None and matched.current_price_amount <= item.target_price,
            )
        )
    items.sort(key=lambda entry: (not entry.is_target_hit, -(entry.cache.current_cut or 0)))
    return items


@dataclass
class IgnoredSalesTitle:
    game: Game
    checked_at: datetime | None


def list_ignored_items(db: Session) -> list[IgnoredSalesTitle]:
    return [
        IgnoredSalesTitle(game=cache.game, checked_at=cache.checked_at) for cache in itad_repository.list_ignored(db)
    ]


def retry_ignored_item(db: Session, game_id: int) -> None:
    cache = itad_repository.get_cache(db, game_id)
    if cache is None or not cache.ignored:
        raise NotFoundError(f"No ignored ITAD entry for game {game_id}")
    itad_repository.set_ignored(db, cache, False)
    db.commit()


def remove_ignored_item(db: Session, game_id: int) -> None:
    """Unlike retry_ignored_item, this is meant to stick: turns off track_for_sales on every
    wishlist row for this game (the same op the Sale - Tracked page's Untrack button does) so
    the refresh job never reconsiders it, then drops the ignored cache row so it disappears
    from this list immediately rather than lingering until the next job run notices it's no
    longer a tracked candidate."""
    cache = itad_repository.get_cache(db, game_id)
    if cache is None or not cache.ignored:
        raise NotFoundError(f"No ignored ITAD entry for game {game_id}")
    for item in library_item_repository.list_library_items(db, game_id, status=LibraryStatus.WISHLIST):
        if item.track_for_sales:
            library_item_repository.update_library_item(db, item, track_for_sales=False)
    itad_repository.delete_cache(db, cache)
    db.commit()
