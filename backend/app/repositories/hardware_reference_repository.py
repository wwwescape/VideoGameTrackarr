from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hardware import HardwareReferenceEntry

# Repositories only add/flush — they never commit. Mirrors manufacturer_repository.py.


def list_entries(db: Session, entry_type: str | None = None) -> list[HardwareReferenceEntry]:
    stmt = select(HardwareReferenceEntry)
    if entry_type is not None:
        stmt = stmt.where(HardwareReferenceEntry.type == entry_type)
    stmt = stmt.order_by(
        HardwareReferenceEntry.brand, HardwareReferenceEntry.generation, HardwareReferenceEntry.official_name
    )
    return list(db.scalars(stmt))


def get_by_official_name(db: Session, official_name: str) -> HardwareReferenceEntry | None:
    return db.scalars(
        select(HardwareReferenceEntry).where(HardwareReferenceEntry.official_name == official_name)
    ).first()


def upsert(db: Session, *, official_name: str, **fields: object) -> HardwareReferenceEntry:
    entry = get_by_official_name(db, official_name)
    if entry is None:
        entry = HardwareReferenceEntry(official_name=official_name)
        db.add(entry)
    for key, value in fields.items():
        setattr(entry, key, value)
    db.flush()
    return entry
