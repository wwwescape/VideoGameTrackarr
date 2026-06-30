from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hardware import Manufacturer


def list_manufacturers(db: Session) -> list[Manufacturer]:
    return list(db.scalars(select(Manufacturer).order_by(Manufacturer.name)))


def get_by_name(db: Session, name: str) -> Manufacturer | None:
    return db.scalars(select(Manufacturer).where(Manufacturer.name == name)).first()


def get_or_create_by_name(db: Session, name: str) -> Manufacturer:
    manufacturer = get_by_name(db, name)
    if manufacturer is not None:
        return manufacturer

    manufacturer = Manufacturer(name=name)
    db.add(manufacturer)
    db.flush()
    return manufacturer
