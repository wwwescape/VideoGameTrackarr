from datetime import datetime
from typing import Literal

from app.models.library import LibraryItem, MediaFormat
from app.schemas.base import CamelModel

SalesProvider = Literal["itad", "platprices"]


class IgnoredSalesTitleResponse(CamelModel):
    provider: SalesProvider
    game_id: int
    game_uuid: str
    game_name: str
    game_slug: str | None
    game_cover_url: str | None
    checked_at: datetime | None


class TrackedSalesItemResponse(CamelModel):
    library_item_id: int
    game_id: int
    game_uuid: str
    game_name: str
    game_slug: str | None
    game_cover_url: str | None
    platform_id: int | None
    platform_name: str | None
    format: MediaFormat | None
    digital_storefront: str | None
    target_price: float | None


def tracked_sales_item_from_orm(item: LibraryItem) -> TrackedSalesItemResponse:
    return TrackedSalesItemResponse(
        library_item_id=item.id,
        game_id=item.game.id,
        game_uuid=item.game.uuid,
        game_name=item.game.name,
        game_slug=item.game.slug,
        game_cover_url=item.game.cover_url,
        platform_id=item.platform_id,
        platform_name=item.platform.name if item.platform else None,
        format=item.format,
        digital_storefront=item.digital_storefront,
        target_price=item.target_price,
    )
