from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hardware import StorageVariant


def list_storage_variants(db: Session) -> list[StorageVariant]:
    return list(db.scalars(select(StorageVariant).order_by(StorageVariant.name)))


def get_by_name(db: Session, name: str) -> StorageVariant | None:
    return db.scalars(select(StorageVariant).where(StorageVariant.name == name)).first()


def get_or_create_by_name(db: Session, name: str) -> StorageVariant:
    storage_variant = get_by_name(db, name)
    if storage_variant is not None:
        return storage_variant

    storage_variant = StorageVariant(name=name)
    db.add(storage_variant)
    db.flush()
    return storage_variant
