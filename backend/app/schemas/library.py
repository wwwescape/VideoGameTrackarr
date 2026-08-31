from datetime import date

from app.models.itad import ItadPriceCache
from app.models.library import LibraryItem, LibraryStatus, MediaFormat, RatingBoard
from app.models.platprices import PlatPricesCache
from app.schemas.base import CamelModel
from app.services.itad_service import is_library_item_itad_eligible
from app.services.platprices_service import is_library_item_platprices_eligible


class LibraryItemResponse(CamelModel):
    id: int
    game_id: int
    platform_id: int | None
    platform_name: str | None
    region_id: int | None
    region_name: str | None
    status: LibraryStatus
    format: MediaFormat | None
    digital_storefront: str | None
    rating_board: RatingBoard | None
    edition: str | None
    price: float | None
    target_price: float | None
    acquired_at: date | None
    notes: str | None
    is_on_sale: bool
    sale_price_amount: float | None
    sale_price_currency: str | None
    sale_shop_name: str | None
    sale_cut: int | None


def library_item_from_orm(
    item: LibraryItem,
    itad_cache: ItadPriceCache | None = None,
    platprices_cache: PlatPricesCache | None = None,
) -> LibraryItemResponse:
    # Each row's platform determines at most one eligible provider — never both, since
    # itad_service/platprices_service's eligible-platform sets are disjoint by construction.
    cache: ItadPriceCache | PlatPricesCache | None = None
    if itad_cache is not None and is_library_item_itad_eligible(item):
        cache = itad_cache
    elif platprices_cache is not None and is_library_item_platprices_eligible(item):
        cache = platprices_cache

    is_on_sale = cache is not None and cache.current_price_amount is not None
    return LibraryItemResponse(
        id=item.id,
        game_id=item.game_id,
        platform_id=item.platform_id,
        platform_name=item.platform.name if item.platform else None,
        region_id=item.region_id,
        region_name=item.region.name if item.region else None,
        status=item.status,
        format=item.format,
        digital_storefront=item.digital_storefront,
        rating_board=item.rating_board,
        edition=item.edition,
        price=item.price,
        target_price=item.target_price,
        acquired_at=item.acquired_at,
        notes=item.notes,
        is_on_sale=is_on_sale,
        sale_price_amount=cache.current_price_amount if is_on_sale else None,
        sale_price_currency=cache.current_price_currency if is_on_sale else None,
        sale_shop_name=cache.current_shop_name if is_on_sale else None,
        sale_cut=cache.current_cut if is_on_sale else None,
    )


class LibraryItemCreateRequest(CamelModel):
    status: LibraryStatus
    platform_id: int | None = None
    region_id: int | None = None
    format: MediaFormat | None = None
    digital_storefront: str | None = None
    rating_board: RatingBoard | None = None
    edition: str | None = None
    price: float | None = None
    target_price: float | None = None
    acquired_at: date | None = None
    notes: str | None = None


class LibraryItemUpdateRequest(CamelModel):
    status: LibraryStatus | None = None
    platform_id: int | None = None
    region_id: int | None = None
    format: MediaFormat | None = None
    digital_storefront: str | None = None
    rating_board: RatingBoard | None = None
    edition: str | None = None
    price: float | None = None
    target_price: float | None = None
    acquired_at: date | None = None
    notes: str | None = None
