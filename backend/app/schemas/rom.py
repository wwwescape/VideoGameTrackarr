from datetime import datetime

from app.models.library import MediaFormat, RomSaveState
from app.schemas.base import CamelModel


class PlayerBiosFile(CamelModel):
    filename: str  # written under exactly this name inside the emulator
    url: str  # signed, short-lived


class PlaySessionResponse(CamelModel):
    rom_url: str
    core: str
    game_name: str
    # Opens in its own cross-origin-isolated tab (frontend/player-isolated.html) — DOS, PSP.
    isolated: bool = False
    bios_files: list[PlayerBiosFile] = []
    # EmulatorJS EJS_defaultOptions the core needs for this session (e.g. which BIOS to use).
    core_options: dict[str, str] = {}


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
    # Platform slugs some bundled core plays — the only platforms ROMs can be uploaded for.
    supported_platform_slugs: list[str]


class RomDownloadLinkResponse(CamelModel):
    url: str  # signed, short-lived; the browser downloads the ROM straight from it


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


class BiosAcceptedFile(CamelModel):
    filename: str
    note: str | None
    satisfies: bool  # on its own, makes a required-BIOS system playable
    has_reference_hash: bool


class BiosUploadedFile(CamelModel):
    id: int
    filename: str
    size_bytes: int
    md5: str
    recognized: bool  # MD5 matches a known-good dump libretro documents
    updated_at: datetime


class BiosSystemResponse(CamelModel):
    key: str
    label: str
    required: bool
    ready: bool
    systems: list[str]  # the emulated systems (EmulatorCore.system) that use this BIOS
    accepted_files: list[BiosAcceptedFile]
    uploaded_files: list[BiosUploadedFile]


class RomUpdateRequest(CamelModel):
    label: str | None = None
