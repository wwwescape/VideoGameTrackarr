from datetime import date

from app.models.library import LibraryItem, LibraryStatus, MediaFormat, RatingBoard
from app.schemas.base import CamelModel


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
    acquired_at: date | None
    notes: str | None


def library_item_from_orm(item: LibraryItem) -> LibraryItemResponse:
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
        acquired_at=item.acquired_at,
        notes=item.notes,
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
    acquired_at: date | None = None
    notes: str | None = None
