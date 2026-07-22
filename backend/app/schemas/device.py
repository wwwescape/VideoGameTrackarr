from app.models.hardware import Device
from app.models.library import RatingBoard, Tag
from app.repositories.device_repository import DeviceWithStatus
from app.schemas.base import CamelModel
from app.schemas.hardware_reference import HardwareReferenceSummary, hardware_reference_summary_from_orm
from app.schemas.tag import TagResponse, tag_from_orm
from app.schemas.user_device import UserDeviceCreateRequest
from app.services.hardware_reference_image_service import resolve_image_url


class DeviceSummaryResponse(CamelModel):
    id: int
    uuid: str
    manufacturer_id: int
    manufacturer_name: str
    hardware_platform_id: int | None
    hardware_platform_name: str | None
    device_type_id: int
    device_type_name: str
    official_name: str
    model: str | None
    revision: str | None
    storage_variant_id: int | None
    storage_variant_name: str | None
    color_id: int | None
    color_name: str | None
    rating_board: RatingBoard | None
    # Curated product shot from the linked HardwareReferenceEntry, if any — Device has no
    # image of its own since every Device today comes from the predefined reference cascade.
    image_url: str | None
    # Computed fresh per request (EXISTS/scalar-subquery against user_devices), never a
    # stored counter — see DeviceWithStatus.
    owned: bool
    wishlisted: bool
    owned_quantity: int
    wishlisted_quantity: int


class LinkedAccessoryResponse(CamelModel):
    id: int
    uuid: str
    official_name: str


class DeviceDetailResponse(DeviceSummaryResponse):
    linked_accessories: list[LinkedAccessoryResponse]
    hardware_reference: HardwareReferenceSummary | None
    tags: list[TagResponse]


def _device_fields(device: Device, with_status: DeviceWithStatus) -> dict:
    return {
        "id": device.id,
        "uuid": device.uuid,
        "manufacturer_id": device.manufacturer_id,
        "manufacturer_name": device.manufacturer.name,
        "hardware_platform_id": device.hardware_platform_id,
        "hardware_platform_name": device.hardware_platform.name if device.hardware_platform else None,
        "device_type_id": device.device_type_id,
        "device_type_name": device.device_type.name,
        "official_name": device.official_name,
        "model": device.model,
        "revision": device.revision,
        "storage_variant_id": device.storage_variant_id,
        "storage_variant_name": device.storage_variant.name if device.storage_variant else None,
        "color_id": device.color_id,
        "color_name": device.color.name if device.color else None,
        "rating_board": device.rating_board,
        "image_url": (
            resolve_image_url(device.hardware_reference_entry.official_name)
            if device.hardware_reference_entry
            else None
        ),
        "owned": with_status.owned,
        "wishlisted": with_status.wishlisted,
        "owned_quantity": with_status.owned_quantity,
        "wishlisted_quantity": with_status.wishlisted_quantity,
    }


def device_summary_from_orm(with_status: DeviceWithStatus) -> DeviceSummaryResponse:
    return DeviceSummaryResponse(**_device_fields(with_status.device, with_status))


def device_detail_from_orm(with_status: DeviceWithStatus, tags: list[Tag]) -> DeviceDetailResponse:
    device = with_status.device
    return DeviceDetailResponse(
        **_device_fields(device, with_status),
        linked_accessories=[
            LinkedAccessoryResponse(
                id=link.accessory.id, uuid=link.accessory.uuid, official_name=link.accessory.official_name
            )
            for link in device.linked_accessories
        ],
        hardware_reference=(
            hardware_reference_summary_from_orm(device.hardware_reference_entry)
            if device.hardware_reference_entry
            else None
        ),
        tags=[tag_from_orm(tag) for tag in tags],
    )


class DeviceCreateRequest(CamelModel):
    manufacturer: str
    device_type: str
    hardware_platform: str | None = None
    official_name: str
    model: str | None = None
    revision: str | None = None
    storage_variant: str | None = None
    color: str | None = None
    rating_board: RatingBoard | None = None
    # Set by the predefined-cascade Add Device form once it resolves a matching
    # HardwareReferenceEntry — links the catalog row to its source reference row so the
    # detail page can show "rich" data (family/category/compatibility/summary). Stays None
    # for any future custom-device creation, which has no reference row to match.
    hardware_reference_entry_id: int | None = None
    # When set, add_user_device is created in the same transaction as the catalog row —
    # the "Add Device" form collects ownership details (status/condition/price/...) in one
    # step rather than a separate "Add copy" dialog. See device_service.create_device.
    ownership: UserDeviceCreateRequest | None = None


class DeviceUpdateRequest(CamelModel):
    manufacturer: str | None = None
    device_type: str | None = None
    hardware_platform: str | None = None
    official_name: str | None = None
    model: str | None = None
    revision: str | None = None
    storage_variant: str | None = None
    color: str | None = None
    rating_board: RatingBoard | None = None
    # Lets an existing catalog row be linked (or relinked) to a HardwareReferenceEntry after
    # creation — e.g. backfilling devices added before the reference table existed.
    hardware_reference_entry_id: int | None = None
