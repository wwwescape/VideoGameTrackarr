from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.catalog import Region


def list_regions(db: Session) -> list[Region]:
    return list(db.scalars(select(Region).order_by(Region.name)))


def get_by_name(db: Session, name: str) -> Region | None:
    return db.scalars(select(Region).where(Region.name == name)).first()


def get_or_create_by_name(db: Session, name: str) -> Region:
    region = get_by_name(db, name)
    if region is not None:
        return region

    region = Region(name=name)
    db.add(region)
    db.flush()
    return region
