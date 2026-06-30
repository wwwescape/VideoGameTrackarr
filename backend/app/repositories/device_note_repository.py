from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hardware import DeviceNote


def list_notes(db: Session, device_id: int) -> list[DeviceNote]:
    stmt = select(DeviceNote).where(DeviceNote.device_id == device_id).order_by(DeviceNote.created_at.desc())
    return list(db.scalars(stmt))


def get_note(db: Session, note_id: int) -> DeviceNote | None:
    return db.scalars(select(DeviceNote).where(DeviceNote.id == note_id)).first()


def create_note(db: Session, device_id: int, body: str) -> DeviceNote:
    note = DeviceNote(device_id=device_id, body=body)
    db.add(note)
    db.flush()
    return note


def update_note(db: Session, note: DeviceNote, body: str) -> DeviceNote:
    note.body = body
    db.flush()
    return note


def delete_note(db: Session, note: DeviceNote) -> None:
    db.delete(note)
    db.flush()
