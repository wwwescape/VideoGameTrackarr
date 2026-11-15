from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hardware import AccessoryCompatibility, HardwarePlatform
from app.repositories import hardware_platform_repository
from app.schemas.accessory import accessory_summary_from_orm
from app.schemas.device import device_summary_from_orm
from app.services import accessory_service, device_service

# Pictures a Hardware → Platforms card shows (devices first, then accessories).
CARD_IMAGE_LIMIT = 4


@dataclass
class LibraryHardwarePlatform:
    platform: HardwarePlatform
    device_count: int = 0
    accessory_count: int = 0
    owned_count: int = 0
    wishlisted_count: int = 0
    image_urls: list[str] = field(default_factory=list)


def list_library_hardware_platforms(db: Session) -> list[LibraryHardwarePlatform]:
    """Every hardware platform with at least one owned or wishlisted device (its platform) or
    accessory (one it's compatible with), with how many of each, how many are owned and
    wishlisted (an item can be both), and a few pictures for its card. Counts match what the
    platform's page lists, since that page uses the same device/accessory platform filters."""
    platforms = {platform.id: platform for platform in hardware_platform_repository.list_hardware_platforms(db)}
    rows: dict[int, LibraryHardwarePlatform] = {}

    def add(platform_id: int, owned: bool, wishlisted: bool, image_url: str | None, *, is_device: bool) -> None:
        platform = platforms.get(platform_id)
        if platform is None:
            return
        row = rows.setdefault(platform_id, LibraryHardwarePlatform(platform))
        if is_device:
            row.device_count += 1
        else:
            row.accessory_count += 1
        row.owned_count += int(owned)
        row.wishlisted_count += int(wishlisted)
        if image_url and len(row.image_urls) < CARD_IMAGE_LIMIT and image_url not in row.image_urls:
            row.image_urls.append(image_url)

    for item in device_service.list_devices(db):
        device = device_summary_from_orm(item)
        if device.hardware_platform_id is not None and (device.owned or device.wishlisted):
            add(device.hardware_platform_id, device.owned, device.wishlisted, device.image_url, is_device=True)

    compatible: dict[int, list[int]] = {}
    for accessory_id, platform_id in db.execute(
        select(AccessoryCompatibility.accessory_id, AccessoryCompatibility.hardware_platform_id)
    ):
        compatible.setdefault(accessory_id, []).append(platform_id)
    for item in accessory_service.list_accessories(db):
        accessory = accessory_summary_from_orm(item)
        if not (accessory.owned or accessory.wishlisted):
            continue
        for platform_id in compatible.get(accessory.id, []):
            add(platform_id, accessory.owned, accessory.wishlisted, accessory.image_url, is_device=False)

    return sorted(rows.values(), key=lambda row: row.platform.name.lower())
