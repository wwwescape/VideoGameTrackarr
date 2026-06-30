from sqlalchemy.orm import Session

from app.models.hardware import AccessoryNote
from app.repositories import accessory_note_repository, accessory_repository
from app.services.exceptions import NotFoundError


def list_notes(db: Session, accessory_id: int) -> list[AccessoryNote]:
    _require_accessory(db, accessory_id)
    return accessory_note_repository.list_notes(db, accessory_id)


def create_note(db: Session, accessory_id: int, body: str) -> AccessoryNote:
    _require_accessory(db, accessory_id)
    note = accessory_note_repository.create_note(db, accessory_id, body)
    db.commit()
    db.refresh(note)
    return note


def update_note(db: Session, note_id: int, body: str) -> AccessoryNote:
    note = _require_note(db, note_id)
    note = accessory_note_repository.update_note(db, note, body)
    db.commit()
    db.refresh(note)
    return note


def delete_note(db: Session, note_id: int) -> None:
    note = _require_note(db, note_id)
    accessory_note_repository.delete_note(db, note)
    db.commit()


def _require_accessory(db: Session, accessory_id: int) -> None:
    if accessory_repository.get_accessory(db, accessory_id) is None:
        raise NotFoundError(f"Accessory {accessory_id} not found")


def _require_note(db: Session, note_id: int) -> AccessoryNote:
    note = accessory_note_repository.get_note(db, note_id)
    if note is None:
        raise NotFoundError(f"Accessory note {note_id} not found")
    return note
