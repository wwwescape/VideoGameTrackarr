from datetime import datetime

from pydantic import Field

from app.models.library import Note
from app.schemas.base import CamelModel


class NoteResponse(CamelModel):
    id: int
    game_id: int
    body: str
    created_at: datetime
    updated_at: datetime


def note_from_orm(note: Note) -> NoteResponse:
    return NoteResponse(
        id=note.id,
        game_id=note.game_id,
        body=note.body,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


class NoteCreateRequest(CamelModel):
    body: str = Field(min_length=1)


class NoteUpdateRequest(CamelModel):
    body: str = Field(min_length=1)
