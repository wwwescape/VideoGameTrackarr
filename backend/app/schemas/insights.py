from app.models.catalog import Game, GameCategory
from app.models.hardware import Accessory
from app.models.library import LibraryItem
from app.schemas.base import CamelModel
from app.schemas.library import LibraryItemResponse, library_item_from_orm


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


def insight_game_ref_from_orm(game: Game) -> InsightGameRefResponse:
    return InsightGameRefResponse(
        id=game.id,
        uuid=game.uuid,
        name=game.name,
        slug=game.slug,
        cover_url=game.cover_url,
        category=game.category,
        first_release_date=game.first_release_date,
    )


class MissingDlcResponse(CamelModel):
    game: InsightGameRefResponse
    missing_addons: list[InsightGameRefResponse]


def missing_dlc_from_orm(game: Game, missing_addons: list[Game]) -> MissingDlcResponse:
    return MissingDlcResponse(
        game=insight_game_ref_from_orm(game),
        missing_addons=[insight_game_ref_from_orm(addon) for addon in missing_addons],
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
