from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.core.security import TokenError, TokenType, create_rom_token, decode_token
from app.models.system import User
from app.repositories import itad_repository, platprices_repository
from app.schemas.library import LibraryItemResponse, library_item_from_orm, rom_summary_from_orm
from app.schemas.rom import (
    EmulationConfigResponse,
    EmulatorCoreResponse,
    InGameSaveResponse,
    PlaySessionResponse,
    SaveStateResponse,
    save_state_from_orm,
)
from app.services import emulation_cores, rom_service

router = APIRouter(tags=["roms"], dependencies=[Depends(get_current_user)])

# Deliberately NOT behind get_current_user: EmulatorJS fetches the ROM itself from inside
# the player iframe and can't send an Authorization header, so this route authenticates via
# the short-lived, single-ROM token embedded in its path instead (see create_rom_token).
content_router = APIRouter(tags=["roms"])


@router.post("/api/library/{item_id}/rom", response_model=LibraryItemResponse, status_code=status.HTTP_201_CREATED)
def upload_rom(item_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)) -> LibraryItemResponse:
    try:
        item = rom_service.save_rom(db, item_id, file.file, file.filename or "")
    except rom_service.RomTooLargeError as exc:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail=str(exc)) from exc
    except rom_service.RomValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    itad_cache = itad_repository.get_cache(db, item.game_id)
    platprices_cache = platprices_repository.get_cache(db, item.game_id)
    return library_item_from_orm(item, itad_cache, platprices_cache)


@router.delete("/api/library/{item_id}/rom", status_code=status.HTTP_204_NO_CONTENT)
def delete_rom(item_id: int, db: Session = Depends(get_db)) -> None:
    rom_service.delete_rom(db, item_id)


@router.post("/api/roms/{rom_id}/play-session", response_model=PlaySessionResponse)
def create_play_session(
    rom_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> PlaySessionResponse:
    rom = rom_service.get_rom(db, rom_id)
    summary = rom_summary_from_orm(rom.library_item)
    if summary is None or not summary.playable or summary.core is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This ROM can't be played in the browser")
    token = create_rom_token(current_user.id, rom.id)
    return PlaySessionResponse(
        rom_url=f"/api/roms/{rom.id}/content/{token}/{quote(rom.original_filename)}",
        core=summary.core,
        game_name=f"vgt-rom-{rom.id}",
    )


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


@router.get("/api/emulation", response_model=EmulationConfigResponse)
def get_emulation_config() -> EmulationConfigResponse:
    return EmulationConfigResponse(
        emulatorjs_version=emulation_cores.EMULATORJS_VERSION,
        cores=[
            EmulatorCoreResponse(
                core=c.core,
                system=c.system,
                license=c.license,
                upstream_url=c.upstream_url,
                non_commercial=c.non_commercial,
            )
            for c in emulation_cores.CORES
        ],
        allowed_upload_extensions={
            fmt: sorted(extensions) for fmt, extensions in emulation_cores.ALLOWED_UPLOAD_EXTENSIONS.items()
        },
        max_upload_mb=get_settings().rom_max_upload_mb,
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
