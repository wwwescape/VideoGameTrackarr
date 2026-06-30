from datetime import datetime

from pydantic import Field

from app.models.hardware import DeviceNote
from app.schemas.base import CamelModel


class DeviceNoteResponse(CamelModel):
    id: int
    device_id: int
    body: str
    created_at: datetime
    updated_at: datetime


def device_note_from_orm(note: DeviceNote) -> DeviceNoteResponse:
    return DeviceNoteResponse(
        id=note.id,
        device_id=note.device_id,
        body=note.body,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


class DeviceNoteCreateRequest(CamelModel):
    body: str = Field(min_length=1)


class DeviceNoteUpdateRequest(CamelModel):
    body: str = Field(min_length=1)
