from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.hardware import Device, UserDevice
from app.models.library import LibraryStatus


def list_all_user_devices(db: Session) -> list[UserDevice]:
    """Every owned/wishlisted device row, for CSV export — not scoped to one device
    item like list_user_devices below. Eager-loads everything CSV export reads off of
    `device` (manufacturer/type/platform) so it isn't a lazy load per row."""
    stmt = (
        select(UserDevice)
        .options(
            joinedload(UserDevice.device).joinedload(Device.manufacturer),
            joinedload(UserDevice.device).joinedload(Device.device_type),
            joinedload(UserDevice.device).joinedload(Device.hardware_platform),
        )
        .join(Device, Device.id == UserDevice.device_id)
        .order_by(Device.official_name)
    )
    return list(db.scalars(stmt))


def list_user_devices(db: Session, device_id: int, status: LibraryStatus | None = None) -> list[UserDevice]:
    stmt = select(UserDevice).where(UserDevice.device_id == device_id)
    if status is not None:
        stmt = stmt.where(UserDevice.status == status)
    stmt = stmt.order_by(UserDevice.id)
    return list(db.scalars(stmt))


def get_user_device(db: Session, item_id: int) -> UserDevice | None:
    stmt = select(UserDevice).options(joinedload(UserDevice.device)).where(UserDevice.id == item_id)
    return db.scalars(stmt).first()


def create_user_device(db: Session, **fields: Any) -> UserDevice:
    item = UserDevice(**fields)
    db.add(item)
    db.flush()
    return item


def update_user_device(db: Session, item: UserDevice, **fields: Any) -> UserDevice:
    for key, value in fields.items():
        setattr(item, key, value)
    db.flush()
    return item


def delete_user_device(db: Session, item: UserDevice) -> None:
    db.delete(item)
    db.flush()
