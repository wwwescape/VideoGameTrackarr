from app.models.hardware import Accessory
from app.models.library import RatingBoard, Tag
from app.repositories.accessory_repository import AccessoryWithStatus
from app.schemas.base import CamelModel
from app.schemas.device import LinkedAccessoryResponse
from app.schemas.hardware_reference import HardwareReferenceSummary, hardware_reference_summary_from_orm
from app.schemas.tag import TagResponse, tag_from_orm
from app.schemas.user_accessory import UserAccessoryCreateRequest


class CompatiblePlatformResponse(CamelModel):
    id: int
    name: str


class LinkedDeviceResponse(CamelModel):
    id: int
    uuid: str
    official_name: str


class AccessorySummaryResponse(CamelModel):
    id: int
    uuid: str
    manufacturer_id: int
    manufacturer_name: str
    accessory_type_id: int
    accessory_type_name: str
    official_name: str
    model: str | None
    revision: str | None
    edition: str | None
    release_date: int | None
    color_id: int | None
    color_name: str | None
    rating_board: RatingBoard | None
    image_url: str | None
    summary: str | None
    owned: bool
    wishlisted: bool
    owned_quantity: int
    wishlisted_quantity: int


class AccessoryDetailResponse(AccessorySummaryResponse):
    compatible_platforms: list[CompatiblePlatformResponse]
    linked_devices: list[LinkedDeviceResponse]
    linked_accessories: list[LinkedAccessoryResponse]
    hardware_reference: HardwareReferenceSummary | None
    tags: list[TagResponse]


def _accessory_fields(accessory: Accessory, with_status: AccessoryWithStatus) -> dict:
    return {
        "id": accessory.id,
        "uuid": accessory.uuid,
        "manufacturer_id": accessory.manufacturer_id,
        "manufacturer_name": accessory.manufacturer.name,
        "accessory_type_id": accessory.accessory_type_id,
        "accessory_type_name": accessory.accessory_type.name,
        "official_name": accessory.official_name,
        "model": accessory.model,
        "revision": accessory.revision,
        "edition": accessory.edition,
        "release_date": accessory.release_date,
        "color_id": accessory.color_id,
        "color_name": accessory.color.name if accessory.color else None,
        "rating_board": accessory.rating_board,
        "image_url": accessory.image_url,
        "summary": accessory.summary,
        "owned": with_status.owned,
        "wishlisted": with_status.wishlisted,
        "owned_quantity": with_status.owned_quantity,
        "wishlisted_quantity": with_status.wishlisted_quantity,
    }


def accessory_summary_from_orm(with_status: AccessoryWithStatus) -> AccessorySummaryResponse:
    return AccessorySummaryResponse(**_accessory_fields(with_status.accessory, with_status))


def _linked_accessories_from_orm(accessory: Accessory) -> list[LinkedAccessoryResponse]:
    # Union of outgoing links (this accessory's own Linked Accessories selection) and
    # incoming ones (other accessories that link to this one) — shown together since the
    # relationship reads the same either way, even though only one side set it.
    by_id = {link.linked_accessory.id: link.linked_accessory for link in accessory.linked_accessories}
    by_id.update({link.accessory.id: link.accessory for link in accessory.linking_accessories})
    return [
        LinkedAccessoryResponse(id=a.id, uuid=a.uuid, official_name=a.official_name)
        for a in sorted(by_id.values(), key=lambda a: a.official_name)
    ]


def accessory_detail_from_orm(with_status: AccessoryWithStatus, tags: list[Tag]) -> AccessoryDetailResponse:
    accessory = with_status.accessory
    return AccessoryDetailResponse(
        **_accessory_fields(accessory, with_status),
        compatible_platforms=[
            CompatiblePlatformResponse(id=link.hardware_platform.id, name=link.hardware_platform.name)
            for link in accessory.compatible_platforms
        ],
        linked_devices=[
            LinkedDeviceResponse(id=link.device.id, uuid=link.device.uuid, official_name=link.device.official_name)
            for link in accessory.linked_devices
        ],
        linked_accessories=_linked_accessories_from_orm(accessory),
        hardware_reference=(
            hardware_reference_summary_from_orm(accessory.hardware_reference_entry)
            if accessory.hardware_reference_entry
            else None
        ),
        tags=[tag_from_orm(tag) for tag in tags],
    )


class AccessoryCreateRequest(CamelModel):
    manufacturer: str
    accessory_type: str
    official_name: str
    model: str | None = None
    revision: str | None = None
    edition: str | None = None
    release_date: int | None = None
    color: str | None = None
    rating_board: RatingBoard | None = None
    # Free text, only collected by the Custom Add Accessory form — see Accessory.summary.
    summary: str | None = None
    image_url: str | None = None
    compatible_platforms: list[str] = []
    device_ids: list[int] = []
    accessory_ids: list[int] = []
    # Set by the predefined-cascade Add Accessory form once it resolves a matching
    # HardwareReferenceEntry — mirrors DeviceCreateRequest.hardware_reference_entry_id.
    # Stays None for custom-mode accessories, which have no reference row to match.
    hardware_reference_entry_id: int | None = None
    # When set, a UserAccessory is created in the same transaction as the catalog row —
    # mirrors DeviceCreateRequest.ownership; see accessory_service.create_accessory.
    ownership: UserAccessoryCreateRequest | None = None


class AccessoryUpdateRequest(CamelModel):
    manufacturer: str | None = None
    accessory_type: str | None = None
    official_name: str | None = None
    model: str | None = None
    revision: str | None = None
    edition: str | None = None
    release_date: int | None = None
    color: str | None = None
    rating_board: RatingBoard | None = None
    summary: str | None = None
    image_url: str | None = None
    compatible_platforms: list[str] | None = None
    device_ids: list[int] | None = None
    accessory_ids: list[int] | None = None
    # Lets an existing catalog row be linked (or relinked) to a HardwareReferenceEntry after
    # creation — e.g. backfilling accessories added before the reference table existed.
    hardware_reference_entry_id: int | None = None
