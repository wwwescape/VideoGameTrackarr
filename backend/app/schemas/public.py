from app.models.catalog import GameCategory
from app.repositories.accessory_repository import AccessoryWithStatus
from app.repositories.device_repository import DeviceWithStatus
from app.repositories.game_repository import GameWithStatus
from app.schemas.base import CamelModel
from app.services.hardware_reference_image_service import resolve_image_url


class PublicGameSummaryResponse(CamelModel):
    id: int
    name: str
    cover_url: str | None
    category: GameCategory | None
    first_release_date: int | None
    owned: bool
    wishlisted: bool


def public_game_from_orm(status: GameWithStatus) -> PublicGameSummaryResponse:
    game = status.game
    return PublicGameSummaryResponse(
        id=game.id,
        name=game.name,
        cover_url=game.cover_url,
        category=game.category,
        first_release_date=game.first_release_date,
        owned=status.owned,
        wishlisted=status.wishlisted,
    )


class PublicDeviceSummaryResponse(CamelModel):
    id: int
    official_name: str
    manufacturer_name: str
    hardware_platform_name: str | None
    image_url: str | None
    owned: bool
    wishlisted: bool
    owned_quantity: int


def public_device_from_orm(item: DeviceWithStatus) -> PublicDeviceSummaryResponse:
    device = item.device
    return PublicDeviceSummaryResponse(
        id=device.id,
        official_name=device.official_name,
        manufacturer_name=device.manufacturer.name,
        hardware_platform_name=device.hardware_platform.name if device.hardware_platform else None,
        image_url=(
            resolve_image_url(device.hardware_reference_entry.official_name)
            if device.hardware_reference_entry
            else None
        ),
        owned=item.owned,
        wishlisted=item.wishlisted,
        owned_quantity=item.owned_quantity,
    )


class PublicAccessorySummaryResponse(CamelModel):
    id: int
    official_name: str
    manufacturer_name: str
    image_url: str | None
    owned: bool
    wishlisted: bool
    owned_quantity: int


def public_accessory_from_orm(item: AccessoryWithStatus) -> PublicAccessorySummaryResponse:
    accessory = item.accessory
    return PublicAccessorySummaryResponse(
        id=accessory.id,
        official_name=accessory.official_name,
        manufacturer_name=accessory.manufacturer.name,
        image_url=accessory.image_url
        or (
            resolve_image_url(accessory.hardware_reference_entry.official_name)
            if accessory.hardware_reference_entry
            else None
        ),
        owned=item.owned,
        wishlisted=item.wishlisted,
        owned_quantity=item.owned_quantity,
    )
