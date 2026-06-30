from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hardware import AccessoryType


def list_accessory_types(db: Session) -> list[AccessoryType]:
    return list(db.scalars(select(AccessoryType).order_by(AccessoryType.name)))


def get_by_name(db: Session, name: str) -> AccessoryType | None:
    return db.scalars(select(AccessoryType).where(AccessoryType.name == name)).first()


def get_or_create_by_name(db: Session, name: str) -> AccessoryType:
    accessory_type = get_by_name(db, name)
    if accessory_type is not None:
        return accessory_type

    accessory_type = AccessoryType(name=name)
    db.add(accessory_type)
    db.flush()
    return accessory_type
