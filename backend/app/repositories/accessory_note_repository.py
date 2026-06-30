from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hardware import AccessoryNote


def list_notes(db: Session, accessory_id: int) -> list[AccessoryNote]:
    stmt = (
        select(AccessoryNote)
        .where(AccessoryNote.accessory_id == accessory_id)
        .order_by(AccessoryNote.created_at.desc())
    )
    return list(db.scalars(stmt))


def get_note(db: Session, note_id: int) -> AccessoryNote | None:
    return db.scalars(select(AccessoryNote).where(AccessoryNote.id == note_id)).first()


def create_note(db: Session, accessory_id: int, body: str) -> AccessoryNote:
    note = AccessoryNote(accessory_id=accessory_id, body=body)
    db.add(note)
    db.flush()
    return note


def update_note(db: Session, note: AccessoryNote, body: str) -> AccessoryNote:
    note.body = body
    db.flush()
    return note


def delete_note(db: Session, note: AccessoryNote) -> None:
    db.delete(note)
    db.flush()
