from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hardware import DeviceType


def list_device_types(db: Session) -> list[DeviceType]:
    return list(db.scalars(select(DeviceType).order_by(DeviceType.name)))


def get_by_name(db: Session, name: str) -> DeviceType | None:
    return db.scalars(select(DeviceType).where(DeviceType.name == name)).first()


def get_or_create_by_name(db: Session, name: str) -> DeviceType:
    device_type = get_by_name(db, name)
    if device_type is not None:
        return device_type

    device_type = DeviceType(name=name)
    db.add(device_type)
    db.flush()
    return device_type
