from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.note import NoteCreateRequest, NoteResponse, NoteUpdateRequest, note_from_orm
from app.services import note_service

router = APIRouter(tags=["notes"], dependencies=[Depends(get_current_user)])


@router.get("/api/games/{game_id}/notes", response_model=list[NoteResponse])
def list_notes(game_id: int, db: Session = Depends(get_db)) -> list[NoteResponse]:
    notes = note_service.list_notes(db, game_id)
    return [note_from_orm(note) for note in notes]


@router.post("/api/games/{game_id}/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(game_id: int, body: NoteCreateRequest, db: Session = Depends(get_db)) -> NoteResponse:
    note = note_service.create_note(db, game_id, body.body)
    return note_from_orm(note)


@router.put("/api/notes/{note_id}", response_model=NoteResponse)
def update_note(note_id: int, body: NoteUpdateRequest, db: Session = Depends(get_db)) -> NoteResponse:
    note = note_service.update_note(db, note_id, body.body)
    return note_from_orm(note)


@router.delete("/api/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, db: Session = Depends(get_db)) -> None:
    note_service.delete_note(db, note_id)
