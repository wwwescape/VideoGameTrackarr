from datetime import datetime

from app.models.library import MediaFormat, RomSaveState
from app.schemas.base import CamelModel


class PlaySessionResponse(CamelModel):
    rom_url: str
    core: str
    game_name: str


class EmulatorCoreResponse(CamelModel):
    core: str
    system: str
    license: str
    upstream_url: str
    non_commercial: bool


class EmulationConfigResponse(CamelModel):
    """Everything the frontend needs to know about in-browser emulation up front: bundled
    cores (for About's credits), which file extensions each copy format accepts (for the
    upload picker's `accept` list), and the upload size cap — so none of it is duplicated
    as a frontend-side list that could drift from the backend's real validation."""

    emulatorjs_version: str
    cores: list[EmulatorCoreResponse]
    allowed_upload_extensions: dict[MediaFormat, list[str]]
    max_upload_mb: int


class SaveStateResponse(CamelModel):
    id: int
    created_at: datetime
    size_bytes: int
    has_screenshot: bool


def save_state_from_orm(state: RomSaveState) -> SaveStateResponse:
    return SaveStateResponse(
        id=state.id,
        created_at=state.created_at,
        size_bytes=state.size_bytes,
        has_screenshot=state.screenshot_filename is not None,
    )


class InGameSaveResponse(CamelModel):
    size_bytes: int
    updated_at: datetime
