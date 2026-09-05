from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.catalog import Game
from app.models.itad import ItadPriceCache
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.repositories import itad_repository, library_item_repository
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
class OnSaleItem:
    library_item: LibraryItem
    cache: ItadPriceCache
    is_target_hit: bool


def list_on_sale_items(db: Session) -> list[OnSaleItem]:
    """Every wishlisted, track_for_sales-opted-in, ITAD-eligible row ITAD currently has a
    discount for — visibility isn't gated on having a target_price set; a target just flags a
    row as "hit" and sorts it first. Rows with tracking off, no ITAD match, not currently
    discounted, or not ITAD-eligible (see is_library_item_itad_eligible) are simply excluded
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
