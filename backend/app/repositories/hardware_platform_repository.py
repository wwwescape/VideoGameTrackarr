from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hardware import HardwarePlatform


def list_hardware_platforms(db: Session) -> list[HardwarePlatform]:
    return list(db.scalars(select(HardwarePlatform).order_by(HardwarePlatform.name)))


def get_by_name(db: Session, name: str) -> HardwarePlatform | None:
    return db.scalars(select(HardwarePlatform).where(HardwarePlatform.name == name)).first()


def get_or_create_by_name(db: Session, name: str) -> HardwarePlatform:
    platform = get_by_name(db, name)
    if platform is not None:
        return platform

    platform = HardwarePlatform(name=name)
    db.add(platform)
    db.flush()
    return platform
