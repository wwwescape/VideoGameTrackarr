from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.library import Note


def list_notes(db: Session, game_id: int) -> list[Note]:
    stmt = select(Note).where(Note.game_id == game_id).order_by(Note.created_at.desc())
    return list(db.scalars(stmt))


def get_note(db: Session, note_id: int) -> Note | None:
    return db.scalars(select(Note).where(Note.id == note_id)).first()


def create_note(db: Session, game_id: int, body: str) -> Note:
    note = Note(game_id=game_id, body=body)
    db.add(note)
    db.flush()
    return note


def update_note(db: Session, note: Note, body: str) -> Note:
    note.body = body
    db.flush()
    return note


def delete_note(db: Session, note: Note) -> None:
    db.delete(note)
    db.flush()
