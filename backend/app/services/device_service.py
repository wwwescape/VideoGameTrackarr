from typing import Any

from sqlalchemy.orm import Session

from app.core.identifiers import extract_uuid
from app.models.library import LibraryStatus
from app.repositories import (
    color_repository,
    device_repository,
    device_type_repository,
    hardware_platform_repository,
    manufacturer_repository,
    region_repository,
    storage_variant_repository,
    user_device_repository,
)
from app.repositories.device_repository import DeviceWithStatus
from app.services.exceptions import NotFoundError

# Lookup fields resolved by name (get-or-create) rather than id — lets the Add Device
# form submit a freshly-typed name (a new color, a new platform, ...) without a separate
# "create this lookup row first" round trip. Mirrors how csv_service.py already resolves
# platform/region by name for games.
_NAME_LOOKUP_RESOLVERS = {
    "manufacturer": ("manufacturer_id", manufacturer_repository.get_or_create_by_name),
    "device_type": ("device_type_id", device_type_repository.get_or_create_by_name),
    "hardware_platform": ("hardware_platform_id", hardware_platform_repository.get_or_create_by_name),
    "region": ("region_id", region_repository.get_or_create_by_name),
    "storage_variant": ("storage_variant_id", storage_variant_repository.get_or_create_by_name),
    "color": ("color_id", color_repository.get_or_create_by_name),
}


def _resolve_lookup_fields(db: Session, fields: dict[str, Any]) -> dict[str, Any]:
    resolved: dict[str, Any] = {}
    for key, value in fields.items():
        if key not in _NAME_LOOKUP_RESOLVERS:
            resolved[key] = value
            continue
        id_field, resolver = _NAME_LOOKUP_RESOLVERS[key]
        resolved[id_field] = resolver(db, value).id if value else None
    return resolved


def list_devices(
    db: Session,
    search: str | None = None,
    manufacturer_id: int | None = None,
    device_type_id: int | None = None,
    hardware_platform_id: int | None = None,
    status: LibraryStatus | None = None,
) -> list[DeviceWithStatus]:
    return device_repository.list_devices(
        db,
        search=search,
        manufacturer_id=manufacturer_id,
        device_type_id=device_type_id,
        hardware_platform_id=hardware_platform_id,
        status=status,
    )


def get_device_detail(db: Session, device_id: int) -> DeviceWithStatus:
    device = device_repository.get_device(db, device_id)
    if device is None:
        raise NotFoundError(f"Device {device_id} not found")
    return device


def get_device_detail_by_identifier(db: Session, identifier: str) -> DeviceWithStatus:
    device_uuid = extract_uuid(identifier)
    device = device_repository.get_device_by_uuid(db, device_uuid) if device_uuid else None
    if device is None:
        raise NotFoundError(f"Device {identifier} not found")
    return device


def create_device(db: Session, ownership: dict[str, Any] | None = None, **fields: Any) -> DeviceWithStatus:
    resolved = _resolve_lookup_fields(db, fields)
    device = device_repository.create_device(db, **resolved)
    if ownership:
        user_device_repository.create_user_device(db, device_id=device.id, **ownership)
    db.commit()
    return get_device_detail(db, device.id)


def update_device(db: Session, device_id: int, **fields: Any) -> DeviceWithStatus:
    existing = get_device_detail(db, device_id)
    resolved = _resolve_lookup_fields(db, fields)
    device_repository.update_device(db, existing.device, **resolved)
    db.commit()
    return get_device_detail(db, device_id)


def delete_device(db: Session, device_id: int) -> None:
    existing = get_device_detail(db, device_id)
    device_repository.delete_device(db, existing.device)
    db.commit()
