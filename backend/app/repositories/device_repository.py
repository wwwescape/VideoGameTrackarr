from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement, delete, exists, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.hardware import AccessoryDeviceLink, Device, DeviceNote, DeviceTag, UserDevice
from app.models.library import LibraryStatus

# Repositories only add/flush/delete — they never commit. The service that calls them owns
# the transaction boundary. Mirrors game_repository.py's shape exactly.


@dataclass
class DeviceWithStatus:
    """A Device row plus whether it's owned/wishlisted and how many copies (a count of
    UserDevice rows — one row per physical unit) — computed fresh via EXISTS/scalar-subquery
    on every query, never a stored counter."""

    device: Device
    owned: bool
    wishlisted: bool
    owned_quantity: int
    wishlisted_quantity: int


def _owned_exists(device_id_column: ColumnElement[int]) -> ColumnElement[bool]:
    return exists().where(UserDevice.device_id == device_id_column, UserDevice.status == LibraryStatus.OWNED)


def _wishlisted_exists(device_id_column: ColumnElement[int]) -> ColumnElement[bool]:
    return exists().where(
        UserDevice.device_id == device_id_column, UserDevice.status == LibraryStatus.WISHLIST
    )


def _count_subquery(device_id_column: ColumnElement[int], status: LibraryStatus) -> ColumnElement[int]:
    return (
        select(func.count(UserDevice.id))
        .where(UserDevice.device_id == device_id_column, UserDevice.status == status)
        .scalar_subquery()
    )


def _row_to_device_with_status(row: Any) -> DeviceWithStatus:
    return DeviceWithStatus(
        device=row[0], owned=bool(row[1]), wishlisted=bool(row[2]), owned_quantity=row[3], wishlisted_quantity=row[4]
    )


_STATUS_COLUMNS = (
    _owned_exists(Device.id),
    _wishlisted_exists(Device.id),
    _count_subquery(Device.id, LibraryStatus.OWNED),
    _count_subquery(Device.id, LibraryStatus.WISHLIST),
)


def list_devices(
    db: Session,
    search: str | None = None,
    manufacturer_id: int | None = None,
    device_type_id: int | None = None,
    hardware_platform_id: int | None = None,
    status: LibraryStatus | None = None,
) -> list[DeviceWithStatus]:
    stmt = select(Device, *_STATUS_COLUMNS)
    if search:
        stmt = stmt.where(Device.official_name.ilike(f"%{search}%"))
    if manufacturer_id is not None:
        stmt = stmt.where(Device.manufacturer_id == manufacturer_id)
    if device_type_id is not None:
        stmt = stmt.where(Device.device_type_id == device_type_id)
    if hardware_platform_id is not None:
        stmt = stmt.where(Device.hardware_platform_id == hardware_platform_id)
    if status is not None:
        stmt = stmt.where(
            exists().where(UserDevice.device_id == Device.id, UserDevice.status == status)
        )
    stmt = stmt.order_by(Device.official_name)
    return [_row_to_device_with_status(row) for row in db.execute(stmt)]


def _get_device_options() -> tuple[Any, ...]:
    return (
        joinedload(Device.manufacturer),
        joinedload(Device.hardware_platform),
        joinedload(Device.device_type),
        joinedload(Device.storage_variant),
        joinedload(Device.color),
        joinedload(Device.hardware_reference_entry),
        selectinload(Device.linked_accessories).joinedload(AccessoryDeviceLink.accessory),
    )


def get_device(db: Session, device_id: int) -> DeviceWithStatus | None:
    stmt = select(Device, *_STATUS_COLUMNS).options(*_get_device_options()).where(Device.id == device_id)
    row = db.execute(stmt).first()
    return _row_to_device_with_status(row) if row else None


def get_device_by_uuid(db: Session, device_uuid: str) -> DeviceWithStatus | None:
    stmt = select(Device, *_STATUS_COLUMNS).options(*_get_device_options()).where(Device.uuid == device_uuid)
    row = db.execute(stmt).first()
    return _row_to_device_with_status(row) if row else None


def create_device(db: Session, **fields: Any) -> Device:
    device = Device(**fields)
    db.add(device)
    db.flush()
    return device


def update_device(db: Session, device: Device, **fields: Any) -> Device:
    for key, value in fields.items():
        setattr(device, key, value)
    db.flush()
    return device


def delete_device(db: Session, device: Device) -> None:
    db.execute(delete(DeviceTag).where(DeviceTag.device_id == device.id))
    db.execute(delete(DeviceNote).where(DeviceNote.device_id == device.id))
    db.delete(device)
    db.flush()
