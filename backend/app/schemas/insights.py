from datetime import datetime

from app.models.catalog import Game, GameCategory
from app.models.hardware import Accessory
from app.models.library import LibraryItem
from app.schemas.base import CamelModel
from app.schemas.library import LibraryItemResponse, library_item_from_orm
from app.services.itad_service import OnSaleItem
from app.services.platprices_service import PlatPricesOnSaleItem


class DuplicateLibraryItemGroupResponse(CamelModel):
    game_id: int
    game_name: str
    game_slug: str | None
    game_uuid: str
    items: list[LibraryItemResponse]


def duplicate_group_from_orm(items: list[LibraryItem]) -> DuplicateLibraryItemGroupResponse:
    return DuplicateLibraryItemGroupResponse(
        game_id=items[0].game_id,
        game_name=items[0].game.name,
        game_slug=items[0].game.slug,
        game_uuid=items[0].game.uuid,
        items=[library_item_from_orm(item) for item in items],
    )


class InsightGameRefResponse(CamelModel):
    id: int
    uuid: str
    name: str
    slug: str | None
    cover_url: str | None
    category: GameCategory | None
    first_release_date: int | None
    # GameCard needs these to decide greyscale/chip — every insights surface that builds one
    # of these refs must pass the real values (defaults below are only a safety net, not
    # something any real caller should rely on).
    owned: bool
    wishlisted: bool
    auto_discovered: bool


def insight_game_ref_from_orm(
    game: Game, *, owned: bool = False, wishlisted: bool = False
) -> InsightGameRefResponse:
    return InsightGameRefResponse(
        id=game.id,
        uuid=game.uuid,
        name=game.name,
        slug=game.slug,
        cover_url=game.cover_url,
        category=game.category,
        first_release_date=game.first_release_date,
        owned=owned,
        wishlisted=wishlisted,
        auto_discovered=game.auto_discovered,
    )


class MissingAddonsResponse(CamelModel):
    game: InsightGameRefResponse
    missing_addons: list[InsightGameRefResponse]


def missing_addons_from_orm(game: Game, missing_addons: list[tuple[Game, bool]]) -> MissingAddonsResponse:
    return MissingAddonsResponse(
        # The repository's own game_owned filter already guarantees this — see
        # insight_repository.find_missing_addons.
        game=insight_game_ref_from_orm(game, owned=True),
        missing_addons=[
            insight_game_ref_from_orm(addon, owned=False, wishlisted=wishlisted)
            for addon, wishlisted in missing_addons
        ],
    )


class InsightAccessoryRefResponse(CamelModel):
    id: int
    uuid: str
    official_name: str
    image_url: str | None
    manufacturer_name: str


def insight_accessory_ref_from_orm(accessory: Accessory) -> InsightAccessoryRefResponse:
    return InsightAccessoryRefResponse(
        id=accessory.id,
        uuid=accessory.uuid,
        official_name=accessory.official_name,
        image_url=accessory.image_url,
        manufacturer_name=accessory.manufacturer.name,
    )


class OnSaleItemResponse(CamelModel):
    library_item_id: int
    game: InsightGameRefResponse
    current_price_amount: float
    current_price_currency: str | None
    current_shop_name: str | None
    current_cut: int | None
    historical_low_amount: float | None
    historical_low_currency: str | None
    historical_low_shop_name: str | None
    historical_low_at: datetime | None
    target_price: float | None
    is_target_hit: bool


def on_sale_item_from_orm(item: OnSaleItem | PlatPricesOnSaleItem) -> OnSaleItemResponse:
    # ItadPriceCache and PlatPricesCache deliberately share the same field names (see
    # models/platprices.py), so this works unchanged for either provider's item.
    library_item = item.library_item
    cache = item.cache
    return OnSaleItemResponse(
        library_item_id=library_item.id,
        # On-sale tracking only ever applies to a wishlisted library_item (see
        # LibraryItem.track_for_sales) — this game is always at least wishlisted here,
        # regardless of whether it's *also* owned via a different library_item/platform,
        # which this ref alone can't distinguish. Frontend's OnSaleSection.tsx sets
        # wishlisted: true itself too (defensively, from before this field existed) — kept,
        # harmless now that both agree.
        game=insight_game_ref_from_orm(library_item.game, wishlisted=True),
        current_price_amount=cache.current_price_amount,
        current_price_currency=cache.current_price_currency,
        current_shop_name=cache.current_shop_name,
        current_cut=cache.current_cut,
        historical_low_amount=cache.historical_low_amount,
        historical_low_currency=cache.historical_low_currency,
        historical_low_shop_name=cache.historical_low_shop_name,
        historical_low_at=cache.historical_low_at,
        target_price=library_item.target_price,
        is_target_hit=item.is_target_hit,
    )
