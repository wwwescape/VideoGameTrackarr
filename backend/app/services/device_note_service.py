from sqlalchemy.orm import Session

from app.models.hardware import DeviceNote
from app.repositories import device_note_repository, device_repository
from app.services.exceptions import NotFoundError


def list_notes(db: Session, device_id: int) -> list[DeviceNote]:
    _require_device(db, device_id)
    return device_note_repository.list_notes(db, device_id)


def create_note(db: Session, device_id: int, body: str) -> DeviceNote:
    _require_device(db, device_id)
    note = device_note_repository.create_note(db, device_id, body)
    db.commit()
    db.refresh(note)
    return note


def update_note(db: Session, note_id: int, body: str) -> DeviceNote:
    note = _require_note(db, note_id)
    note = device_note_repository.update_note(db, note, body)
    db.commit()
    db.refresh(note)
    return note


def delete_note(db: Session, note_id: int) -> None:
    note = _require_note(db, note_id)
    device_note_repository.delete_note(db, note)
    db.commit()


def _require_device(db: Session, device_id: int) -> None:
    if device_repository.get_device(db, device_id) is None:
        raise NotFoundError(f"Device {device_id} not found")


def _require_note(db: Session, note_id: int) -> DeviceNote:
    note = device_note_repository.get_note(db, note_id)
    if note is None:
        raise NotFoundError(f"Device note {note_id} not found")
    return note
