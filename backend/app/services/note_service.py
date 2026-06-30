from sqlalchemy.orm import Session

from app.models.library import Note
from app.repositories import game_repository, note_repository
from app.services.exceptions import NotFoundError


def list_notes(db: Session, game_id: int) -> list[Note]:
    _require_game(db, game_id)
    return note_repository.list_notes(db, game_id)


def create_note(db: Session, game_id: int, body: str) -> Note:
    _require_game(db, game_id)
    note = note_repository.create_note(db, game_id, body)
    db.commit()
    db.refresh(note)
    return note


def update_note(db: Session, note_id: int, body: str) -> Note:
    note = _require_note(db, note_id)
    note = note_repository.update_note(db, note, body)
    db.commit()
    db.refresh(note)
    return note


def delete_note(db: Session, note_id: int) -> None:
    note = _require_note(db, note_id)
    note_repository.delete_note(db, note)
    db.commit()


def _require_game(db: Session, game_id: int) -> None:
    if game_repository.get_game(db, game_id) is None:
        raise NotFoundError(f"Game {game_id} not found")


def _require_note(db: Session, note_id: int) -> Note:
    note = note_repository.get_note(db, note_id)
    if note is None:
        raise NotFoundError(f"Note {note_id} not found")
    return note
