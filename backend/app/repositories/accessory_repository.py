from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement, delete, exists, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.hardware import (
    Accessory,
    AccessoryAccessoryLink,
    AccessoryCompatibility,
    AccessoryDeviceLink,
    AccessoryNote,
    AccessoryTag,
    UserAccessory,
)
from app.models.library import LibraryStatus

# Repositories only add/flush/delete — they never commit. Mirrors device_repository.py.


@dataclass
class AccessoryWithStatus:
    accessory: Accessory
    owned: bool
    wishlisted: bool
    owned_quantity: int
    wishlisted_quantity: int


def _owned_exists(accessory_id_column: ColumnElement[int]) -> ColumnElement[bool]:
    return exists().where(
        UserAccessory.accessory_id == accessory_id_column, UserAccessory.status == LibraryStatus.OWNED
    )


def _wishlisted_exists(accessory_id_column: ColumnElement[int]) -> ColumnElement[bool]:
    return exists().where(
        UserAccessory.accessory_id == accessory_id_column, UserAccessory.status == LibraryStatus.WISHLIST
    )


def _count_subquery(accessory_id_column: ColumnElement[int], status: LibraryStatus) -> ColumnElement[int]:
    return (
        select(func.count(UserAccessory.id))
        .where(UserAccessory.accessory_id == accessory_id_column, UserAccessory.status == status)
        .scalar_subquery()
    )


def _row_to_accessory_with_status(row: Any) -> AccessoryWithStatus:
    return AccessoryWithStatus(
        accessory=row[0], owned=bool(row[1]), wishlisted=bool(row[2]), owned_quantity=row[3], wishlisted_quantity=row[4]
    )


_STATUS_COLUMNS = (
    _owned_exists(Accessory.id),
    _wishlisted_exists(Accessory.id),
    _count_subquery(Accessory.id, LibraryStatus.OWNED),
    _count_subquery(Accessory.id, LibraryStatus.WISHLIST),
)


def list_accessories(
    db: Session,
    search: str | None = None,
    manufacturer_id: int | None = None,
    accessory_type_id: int | None = None,
    hardware_platform_id: int | None = None,
    status: LibraryStatus | None = None,
) -> list[AccessoryWithStatus]:
    stmt = select(Accessory, *_STATUS_COLUMNS)
    if search:
        stmt = stmt.where(Accessory.official_name.ilike(f"%{search}%"))
    if manufacturer_id is not None:
        stmt = stmt.where(Accessory.manufacturer_id == manufacturer_id)
    if accessory_type_id is not None:
        stmt = stmt.where(Accessory.accessory_type_id == accessory_type_id)
    if hardware_platform_id is not None:
        stmt = stmt.where(
            exists().where(
                AccessoryCompatibility.accessory_id == Accessory.id,
                AccessoryCompatibility.hardware_platform_id == hardware_platform_id,
            )
        )
    if status is not None:
        stmt = stmt.where(
            exists().where(UserAccessory.accessory_id == Accessory.id, UserAccessory.status == status)
        )
    stmt = stmt.order_by(Accessory.official_name)
    return [_row_to_accessory_with_status(row) for row in db.execute(stmt)]


def _get_accessory_options() -> tuple[Any, ...]:
    return (
        joinedload(Accessory.manufacturer),
        joinedload(Accessory.accessory_type),
        joinedload(Accessory.color),
        joinedload(Accessory.hardware_reference_entry),
        selectinload(Accessory.compatible_platforms).joinedload(AccessoryCompatibility.hardware_platform),
        selectinload(Accessory.linked_devices).joinedload(AccessoryDeviceLink.device),
        selectinload(Accessory.linked_accessories).joinedload(AccessoryAccessoryLink.linked_accessory),
        selectinload(Accessory.linking_accessories).joinedload(AccessoryAccessoryLink.accessory),
    )


def get_accessory(db: Session, accessory_id: int) -> AccessoryWithStatus | None:
    stmt = (
        select(Accessory, *_STATUS_COLUMNS).options(*_get_accessory_options()).where(Accessory.id == accessory_id)
    )
    row = db.execute(stmt).first()
    return _row_to_accessory_with_status(row) if row else None


def get_accessory_by_uuid(db: Session, accessory_uuid: str) -> AccessoryWithStatus | None:
    stmt = (
        select(Accessory, *_STATUS_COLUMNS)
        .options(*_get_accessory_options())
        .where(Accessory.uuid == accessory_uuid)
    )
    row = db.execute(stmt).first()
    return _row_to_accessory_with_status(row) if row else None


def create_accessory(db: Session, **fields: Any) -> Accessory:
    accessory = Accessory(**fields)
    db.add(accessory)
    db.flush()
    return accessory


def update_accessory(db: Session, accessory: Accessory, **fields: Any) -> Accessory:
    for key, value in fields.items():
        setattr(accessory, key, value)
    db.flush()
    return accessory


def delete_accessory(db: Session, accessory: Accessory) -> None:
    db.execute(delete(AccessoryTag).where(AccessoryTag.accessory_id == accessory.id))
    db.execute(delete(AccessoryNote).where(AccessoryNote.accessory_id == accessory.id))
    # Only the incoming side needs explicit cleanup — the outgoing side is already covered
    # by the `linked_accessories` relationship's own cascade="all, delete-orphan".
    db.execute(delete(AccessoryAccessoryLink).where(AccessoryAccessoryLink.linked_accessory_id == accessory.id))
    db.delete(accessory)
    db.flush()


def set_compatible_platforms(db: Session, accessory: Accessory, hardware_platform_ids: list[int]) -> None:
    accessory.compatible_platforms = [
        AccessoryCompatibility(hardware_platform_id=platform_id) for platform_id in hardware_platform_ids
    ]
    db.flush()


def set_linked_devices(db: Session, accessory: Accessory, device_ids: list[int]) -> None:
    accessory.linked_devices = [AccessoryDeviceLink(device_id=device_id) for device_id in device_ids]
    db.flush()


def set_linked_accessories(db: Session, accessory: Accessory, accessory_ids: list[int]) -> None:
    accessory.linked_accessories = [
        AccessoryAccessoryLink(linked_accessory_id=linked_accessory_id) for linked_accessory_id in accessory_ids
    ]
    db.flush()
