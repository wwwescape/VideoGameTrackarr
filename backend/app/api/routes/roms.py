from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.core.security import TokenError, TokenType, create_bios_token, create_rom_token, decode_token
from app.models.system import User
from app.repositories import itad_repository, platprices_repository
from app.schemas.library import LibraryItemResponse, library_item_from_orm, rom_summary_from_orm
from app.schemas.rom import (
    BiosAcceptedFile,
    BiosSystemResponse,
    BiosUploadedFile,
    EmulationConfigResponse,
    EmulatorCoreResponse,
    InGameSaveResponse,
    PlayerBiosFile,
    PlaySessionResponse,
    RomDownloadLinkResponse,
    RomUpdateRequest,
    SaveStateResponse,
    save_state_from_orm,
)
from app.services import bios_service, emulation_cores, rom_service

router = APIRouter(tags=["roms"], dependencies=[Depends(get_current_user)])

# Deliberately NOT behind get_current_user: EmulatorJS fetches the ROM itself from inside
# the player iframe and can't send an Authorization header, so this route authenticates via
# the short-lived, single-ROM token embedded in its path instead (see create_rom_token).
content_router = APIRouter(tags=["roms"])


def _item_response(db: Session, item) -> LibraryItemResponse:
    itad_cache = itad_repository.get_cache(db, item.game_id)
    platprices_cache = platprices_repository.get_cache(db, item.game_id)
    return library_item_from_orm(item, itad_cache, platprices_cache)


@router.post("/api/library/{item_id}/roms", response_model=LibraryItemResponse, status_code=status.HTTP_201_CREATED)
def add_rom(
    item_id: int,
    file: UploadFile = File(...),
    label: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> LibraryItemResponse:
    try:
        item = rom_service.add_rom(db, item_id, file.file, file.filename or "", label)
    except (rom_service.RomTooLargeError, rom_service.RomValidationError) as exc:
        raise _upload_errors_to_http(exc) from exc
    return _item_response(db, item)


@router.put("/api/roms/{rom_id}", response_model=LibraryItemResponse)
def replace_rom(rom_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)) -> LibraryItemResponse:
    """Replaces the ROM's file. Its saves only fit the old file, so they're deleted too."""
    try:
        item = rom_service.replace_rom_file(db, rom_id, file.file, file.filename or "")
    except (rom_service.RomTooLargeError, rom_service.RomValidationError) as exc:
        raise _upload_errors_to_http(exc) from exc
    return _item_response(db, item)


@router.patch("/api/roms/{rom_id}", response_model=LibraryItemResponse)
def update_rom(rom_id: int, body: RomUpdateRequest, db: Session = Depends(get_db)) -> LibraryItemResponse:
    """Sets (or, with null/empty, clears) the ROM's label."""
    return _item_response(db, rom_service.update_rom_label(db, rom_id, body.label))


@router.delete("/api/roms/{rom_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rom(rom_id: int, db: Session = Depends(get_db)) -> None:
    rom_service.delete_rom(db, rom_id)


@router.post("/api/roms/{rom_id}/download-link", response_model=RomDownloadLinkResponse)
def create_rom_download_link(
    rom_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> RomDownloadLinkResponse:
    """A signed link to the ROM's original file, for downloading it back — the same
    short-lived content route the player uses (served as an attachment under the original
    file name), so a multi-GB disc image streams straight to disk instead of through a
    script. Works whether or not the ROM is playable."""
    rom = rom_service.get_rom(db, rom_id)
    token = create_rom_token(current_user.id, rom.id)
    return RomDownloadLinkResponse(url=f"/api/roms/{rom.id}/content/{token}/{quote(rom.original_filename)}")


@router.post("/api/roms/{rom_id}/play-session", response_model=PlaySessionResponse)
def create_play_session(
    rom_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> PlaySessionResponse:
    rom = rom_service.get_rom(db, rom_id)
    summary = rom_summary_from_orm(rom)
    if not summary.playable or summary.core is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This ROM can't be played in the browser")
    core = emulation_cores.core_for_platform(rom.library_item.platform.slug if rom.library_item.platform else None)
    token = create_rom_token(current_user.id, rom.id)

    bios_files: list[PlayerBiosFile] = []
    core_options: dict[str, str] = {}
    if core is not None and core.bios_system:
        uploaded = bios_service.files_for_system(db, core.bios_system)
        for bios_file in uploaded:
            bios_token = create_bios_token(current_user.id, bios_file.id)
            bios_files.append(
                PlayerBiosFile(
                    filename=bios_file.filename,
                    url=f"/api/emulation/bios/content/{bios_file.id}/{bios_token}/{quote(bios_file.filename)}",
                )
            )
        option = emulation_cores.BIOS_CORE_OPTION.get(core.bios_system)
        system = emulation_cores.BIOS_SYSTEMS[core.bios_system]
        usable = [f.filename for f in uploaded if (spec := system.spec_for(f.filename)) and spec.satisfies]
        if option and usable:
            core_options[option] = usable[0]

    return PlaySessionResponse(
        rom_url=f"/api/roms/{rom.id}/content/{token}/{quote(rom.original_filename)}",
        core=summary.core,
        game_name=f"vgt-rom-{rom.id}",
        isolated=summary.isolated,
        bios_files=bios_files,
        core_options=core_options,
    )


# --- BIOS files (Settings → Emulation) ------------------------------------------------------


def _bios_system_response(system, uploaded, ready: frozenset[str]) -> BiosSystemResponse:
    return BiosSystemResponse(
        key=system.key,
        label=system.label,
        required=system.required,
        ready=system.key in ready,
        systems=sorted({c.system for c in emulation_cores.CORES if c.bios_system == system.key}),
        accepted_files=[
            BiosAcceptedFile(filename=f.filename, note=f.note, satisfies=f.satisfies, has_reference_hash=bool(f.md5s))
            for f in system.files
        ],
        uploaded_files=[
            BiosUploadedFile(
                id=f.id,
                filename=f.filename,
                size_bytes=f.size_bytes,
                md5=f.md5,
                recognized=bios_service.is_recognized(f),
                updated_at=f.updated_at,
            )
            for f in uploaded
        ],
    )


@router.get("/api/emulation/bios", response_model=list[BiosSystemResponse])
def list_bios(db: Session = Depends(get_db)) -> list[BiosSystemResponse]:
    ready = bios_service.ready_systems(db)
    files = bios_service.list_files(db)
    return [
        _bios_system_response(system, [f for f in files if f.system == system.key], ready)
        for system in emulation_cores.BIOS_SYSTEMS.values()
    ]


@router.post("/api/emulation/bios/{system}", response_model=BiosSystemResponse, status_code=status.HTTP_201_CREATED)
def upload_bios(system: str, file: UploadFile = File(...), db: Session = Depends(get_db)) -> BiosSystemResponse:
    try:
        bios_service.upload(db, system, file.file, file.filename or "")
    except (rom_service.RomTooLargeError, rom_service.RomValidationError) as exc:
        raise _upload_errors_to_http(exc) from exc
    return _bios_system_response(
        bios_service.require_system(system), bios_service.files_for_system(db, system), bios_service.ready_systems(db)
    )


@router.delete("/api/emulation/bios/{bios_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bios(bios_id: int, db: Session = Depends(get_db)) -> None:
    bios_service.delete(db, bios_id)


def _upload_errors_to_http(exc: Exception) -> HTTPException:
    if isinstance(exc, rom_service.RomTooLargeError):
        return HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# --- Save states + in-game saves ------------------------------------------------------------
# Called from the app page hosting the player (EmulatorPlayerDialog.tsx), never from inside
# the player iframe itself — so they use the normal Bearer auth, not a signed URL.


@router.get("/api/roms/{rom_id}/states", response_model=list[SaveStateResponse])
def list_save_states(rom_id: int, db: Session = Depends(get_db)) -> list[SaveStateResponse]:
    return [save_state_from_orm(s) for s in rom_service.list_save_states(db, rom_id)]


@router.post("/api/roms/{rom_id}/states", response_model=SaveStateResponse, status_code=status.HTTP_201_CREATED)
def create_save_state(
    rom_id: int,
    state: UploadFile = File(...),
    screenshot: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
) -> SaveStateResponse:
    try:
        save_state = rom_service.create_save_state(
            db,
            rom_id,
            state.file,
            screenshot.file if screenshot is not None else None,
            screenshot.content_type if screenshot is not None else None,
        )
    except (rom_service.RomTooLargeError, rom_service.RomValidationError) as exc:
        raise _upload_errors_to_http(exc) from exc
    return save_state_from_orm(save_state)


@router.get("/api/roms/{rom_id}/states/{state_id}/data")
def get_save_state_data(rom_id: int, state_id: int, db: Session = Depends(get_db)) -> FileResponse:
    save_state = rom_service.get_save_state(db, rom_id, state_id)
    return _private_file(rom_service.get_save_state_path(save_state), "application/octet-stream")


@router.get("/api/roms/{rom_id}/states/{state_id}/screenshot")
def get_save_state_screenshot(rom_id: int, state_id: int, db: Session = Depends(get_db)) -> FileResponse:
    save_state = rom_service.get_save_state(db, rom_id, state_id)
    path = rom_service.get_screenshot_path(save_state)
    if path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This save state has no screenshot")
    return _private_file(path, save_state.screenshot_media_type or "application/octet-stream")


@router.delete("/api/roms/{rom_id}/states/{state_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_save_state(rom_id: int, state_id: int, db: Session = Depends(get_db)) -> None:
    rom_service.delete_save_state(db, rom_id, state_id)


@router.get("/api/roms/{rom_id}/sram")
def get_in_game_save(rom_id: int, db: Session = Depends(get_db)) -> FileResponse:
    return _private_file(rom_service.get_sram_path(db, rom_id), "application/octet-stream")


@router.put("/api/roms/{rom_id}/sram", response_model=InGameSaveResponse)
def put_in_game_save(rom_id: int, save: UploadFile = File(...), db: Session = Depends(get_db)) -> InGameSaveResponse:
    try:
        rom = rom_service.put_sram(db, rom_id, save.file)
    except (rom_service.RomTooLargeError, rom_service.RomValidationError) as exc:
        raise _upload_errors_to_http(exc) from exc
    return InGameSaveResponse(size_bytes=rom.sram_size_bytes or 0, updated_at=rom.sram_updated_at)


@router.delete("/api/roms/{rom_id}/sram", status_code=status.HTTP_204_NO_CONTENT)
def delete_in_game_save(rom_id: int, db: Session = Depends(get_db)) -> None:
    rom_service.delete_sram(db, rom_id)


def _private_file(path, media_type: str) -> FileResponse:
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File is missing")
    return FileResponse(path, media_type=media_type, headers={"Cache-Control": "private, no-store"})


def _core_credits() -> list[EmulatorCoreResponse]:
    """One credit per bundled core, with every system it plays joined (a core can appear in
    CORES more than once, e.g. Genesis Plus GX for cartridges and for Sega CD)."""
    credits: dict[str, EmulatorCoreResponse] = {}
    for c in emulation_cores.CORES:
        if c.core in credits:
            credits[c.core].system += f", {c.system}"
            continue
        credits[c.core] = EmulatorCoreResponse(
            core=c.core, system=c.system, license=c.license, upstream_url=c.upstream_url,
            non_commercial=c.non_commercial,
        )
    return list(credits.values())


@router.get("/api/emulation", response_model=EmulationConfigResponse)
def get_emulation_config() -> EmulationConfigResponse:
    return EmulationConfigResponse(
        emulatorjs_version=emulation_cores.EMULATORJS_VERSION,
        cores=_core_credits(),
        allowed_upload_extensions={
            fmt: sorted(extensions) for fmt, extensions in emulation_cores.ALLOWED_UPLOAD_EXTENSIONS.items()
        },
        max_upload_mb=get_settings().rom_max_upload_mb,
        supported_platform_slugs=sorted({slug for c in emulation_cores.CORES for slug in c.platform_slugs}),
    )


@content_router.api_route("/api/roms/{rom_id}/content/{token}/{filename}", methods=["GET", "HEAD"])
def get_rom_content(rom_id: int, token: str, filename: str, db: Session = Depends(get_db)) -> FileResponse:
    """The trailing {filename} is ignored for lookup — it's there because EmulatorJS derives
    the game's file name (and so which loader the core uses) from the URL's last path
    segment."""
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired ROM link")
    try:
        payload = decode_token(token, TokenType.ROM)
    except TokenError as exc:
        raise unauthorized from exc
    if payload.get("rom") != rom_id or db.get(User, int(payload["sub"])) is None:
        raise unauthorized

    rom = rom_service.get_rom(db, rom_id)
    path = rom_service.get_rom_path(rom)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ROM file is missing")
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=rom.original_filename,
        headers={"Cache-Control": "private, no-store"},
    )


@content_router.api_route("/api/emulation/bios/content/{bios_id}/{token}/{filename}", methods=["GET", "HEAD"])
def get_bios_content(bios_id: int, token: str, filename: str, db: Session = Depends(get_db)) -> FileResponse:
    """Signed-URL download of one BIOS file for the player — same shape as get_rom_content."""
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired BIOS link")
    try:
        payload = decode_token(token, TokenType.BIOS)
    except TokenError as exc:
        raise unauthorized from exc
    if payload.get("bios") != bios_id or db.get(User, int(payload["sub"])) is None:
        raise unauthorized
    bios_file = bios_service.get_file(db, bios_id)
    return _private_file(bios_service.file_path(bios_file), "application/octet-stream")
