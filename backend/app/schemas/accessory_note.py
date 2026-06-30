from datetime import datetime

from pydantic import Field

from app.models.hardware import AccessoryNote
from app.schemas.base import CamelModel


class AccessoryNoteResponse(CamelModel):
    id: int
    accessory_id: int
    body: str
    created_at: datetime
    updated_at: datetime


def accessory_note_from_orm(note: AccessoryNote) -> AccessoryNoteResponse:
    return AccessoryNoteResponse(
        id=note.id,
        accessory_id=note.accessory_id,
        body=note.body,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


class AccessoryNoteCreateRequest(CamelModel):
    body: str = Field(min_length=1)


class AccessoryNoteUpdateRequest(CamelModel):
    body: str = Field(min_length=1)
