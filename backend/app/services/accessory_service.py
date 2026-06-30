from typing import Any

from sqlalchemy.orm import Session

from app.core.identifiers import extract_uuid
from app.models.library import LibraryStatus
from app.repositories import (
    accessory_repository,
    accessory_type_repository,
    color_repository,
    device_repository,
    hardware_platform_repository,
    manufacturer_repository,
    user_accessory_repository,
)
from app.repositories.accessory_repository import AccessoryWithStatus
from app.services.exceptions import NotFoundError

_NAME_LOOKUP_RESOLVERS = {
    "manufacturer": ("manufacturer_id", manufacturer_repository.get_or_create_by_name),
    "accessory_type": ("accessory_type_id", accessory_type_repository.get_or_create_by_name),
    "color": ("color_id", color_repository.get_or_create_by_name),
}


def _resolve_lookup_fields(db: Session, fields: dict[str, Any]) -> dict[str, Any]:
    resolved: dict[str, Any] = {}
    compatible_platform_names = fields.pop("compatible_platforms", None)
    device_ids = fields.pop("device_ids", None)
    accessory_ids = fields.pop("accessory_ids", None)
    for key, value in fields.items():
        if key not in _NAME_LOOKUP_RESOLVERS:
            resolved[key] = value
            continue
        id_field, resolver = _NAME_LOOKUP_RESOLVERS[key]
        resolved[id_field] = resolver(db, value).id if value else None
    if compatible_platform_names is not None:
        resolved["compatible_platforms"] = compatible_platform_names
    if device_ids is not None:
        resolved["device_ids"] = device_ids
    if accessory_ids is not None:
        resolved["accessory_ids"] = accessory_ids
    return resolved


def _require_device_ids_exist(db: Session, device_ids: list[int]) -> None:
    for device_id in device_ids:
        if device_repository.get_device(db, device_id) is None:
            raise NotFoundError(f"Device {device_id} not found")


def _require_accessory_ids_exist(db: Session, accessory_ids: list[int]) -> None:
    for linked_accessory_id in accessory_ids:
        if accessory_repository.get_accessory(db, linked_accessory_id) is None:
            raise NotFoundError(f"Accessory {linked_accessory_id} not found")


def list_accessories(
    db: Session,
    search: str | None = None,
    manufacturer_id: int | None = None,
    accessory_type_id: int | None = None,
    hardware_platform_id: int | None = None,
    status: LibraryStatus | None = None,
) -> list[AccessoryWithStatus]:
    return accessory_repository.list_accessories(
        db,
        search=search,
        manufacturer_id=manufacturer_id,
        accessory_type_id=accessory_type_id,
        hardware_platform_id=hardware_platform_id,
        status=status,
    )


def get_accessory_detail(db: Session, accessory_id: int) -> AccessoryWithStatus:
    accessory = accessory_repository.get_accessory(db, accessory_id)
    if accessory is None:
        raise NotFoundError(f"Accessory {accessory_id} not found")
    return accessory


def get_accessory_detail_by_identifier(db: Session, identifier: str) -> AccessoryWithStatus:
    accessory_uuid = extract_uuid(identifier)
    accessory = accessory_repository.get_accessory_by_uuid(db, accessory_uuid) if accessory_uuid else None
    if accessory is None:
        raise NotFoundError(f"Accessory {identifier} not found")
    return accessory


def create_accessory(db: Session, ownership: dict[str, Any] | None = None, **fields: Any) -> AccessoryWithStatus:
    resolved = _resolve_lookup_fields(db, fields)
    platform_names = resolved.pop("compatible_platforms", [])
    device_ids = resolved.pop("device_ids", [])
    accessory_ids = resolved.pop("accessory_ids", [])
    _require_device_ids_exist(db, device_ids)
    _require_accessory_ids_exist(db, accessory_ids)
    accessory = accessory_repository.create_accessory(db, **resolved)
    if platform_names:
        platform_ids = [
            hardware_platform_repository.get_or_create_by_name(db, name).id for name in platform_names
        ]
        accessory_repository.set_compatible_platforms(db, accessory, platform_ids)
    if device_ids:
        accessory_repository.set_linked_devices(db, accessory, device_ids)
    if accessory_ids:
        accessory_repository.set_linked_accessories(db, accessory, accessory_ids)
    if ownership:
        user_accessory_repository.create_user_accessory(db, accessory_id=accessory.id, **ownership)
    db.commit()
    return get_accessory_detail(db, accessory.id)


def update_accessory(db: Session, accessory_id: int, **fields: Any) -> AccessoryWithStatus:
    existing = get_accessory_detail(db, accessory_id)
    resolved = _resolve_lookup_fields(db, fields)
    platform_names = resolved.pop("compatible_platforms", None)
    device_ids = resolved.pop("device_ids", None)
    accessory_ids = resolved.pop("accessory_ids", None)
    if device_ids is not None:
        _require_device_ids_exist(db, device_ids)
    if accessory_ids is not None:
        # Defense in depth — the multi-select shouldn't ever offer the accessory itself,
        # but a self-link would otherwise just silently sit there doing nothing useful.
        accessory_ids = [linked_id for linked_id in accessory_ids if linked_id != accessory_id]
        _require_accessory_ids_exist(db, accessory_ids)
    accessory_repository.update_accessory(db, existing.accessory, **resolved)
    if platform_names is not None:
        platform_ids = [
            hardware_platform_repository.get_or_create_by_name(db, name).id for name in platform_names
        ]
        accessory_repository.set_compatible_platforms(db, existing.accessory, platform_ids)
    if device_ids is not None:
        accessory_repository.set_linked_devices(db, existing.accessory, device_ids)
    if accessory_ids is not None:
        accessory_repository.set_linked_accessories(db, existing.accessory, accessory_ids)
    db.commit()
    return get_accessory_detail(db, accessory_id)


def delete_accessory(db: Session, accessory_id: int) -> None:
    existing = get_accessory_detail(db, accessory_id)
    accessory_repository.delete_accessory(db, existing.accessory)
    db.commit()
