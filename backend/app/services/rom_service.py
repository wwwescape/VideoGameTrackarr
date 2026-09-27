"""Uploaded ROM files for in-browser emulation — storage, validation, and cleanup.

Every path that removes a RomFile row (deleting the copy, deleting the whole game, changing
a copy's format/status so it can no longer hold a ROM, restoring a backup) goes through a
function here, so a file on disk never outlives its row. A copy can hold several ROMs (e.g.
different regions or revisions), each with its own saves. The same goes for a ROM's save
states and in-game save, which live alongside it (states/ and saves/ under the ROM dir) and
are always removed together with it.
"""

import uuid
import zipfile
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import BinaryIO

from sqlalchemy.orm import Session

from app.core.config import UPLOADS_DIR, get_settings
from app.models.library import LibraryItem, LibraryStatus, MediaFormat, RomFile, RomSaveState
from app.repositories import library_item_repository
from app.services import emulation_cores
from app.services.exceptions import NotFoundError

ROMS_SUBDIR = "roms"
STATES_SUBDIR = "states"
SAVES_SUBDIR = "saves"
_CHUNK_SIZE = 1024 * 1024
MAX_STATE_BYTES = 64 * 1024 * 1024
MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
MAX_SRAM_BYTES = 16 * 1024 * 1024
SCREENSHOT_EXTENSIONS = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}


class RomValidationError(ValueError):
    """The upload itself is unacceptable (wrong copy type, extension, corrupt zip) — 400."""


class RomTooLargeError(ValueError):
    """The upload exceeds ROM_MAX_UPLOAD_MB — 413."""


def get_rom_dir() -> Path:
    override = get_settings().rom_storage_dir
    return Path(override) if override else UPLOADS_DIR / ROMS_SUBDIR


def get_rom_path(rom: RomFile) -> Path:
    return _safe_path(rom.stored_filename)


def can_hold_rom(status: LibraryStatus, media_format: MediaFormat | None) -> bool:
    return status == LibraryStatus.OWNED and media_format in emulation_cores.ROM_CAPABLE_FORMATS


def _extension_of(filename: str) -> str:
    suffix = PurePosixPath(filename.replace("\\", "/")).suffix
    return suffix.removeprefix(".").lower()


def _safe_path(stored_filename: str) -> Path:
    """stored_filename is always one we generated, but resolve and confirm it anyway — same
    defensive guard as upload_service.delete_if_local_upload."""
    rom_dir = get_rom_dir().resolve()
    candidate = (rom_dir / stored_filename).resolve()
    if not candidate.is_relative_to(rom_dir):
        raise RomValidationError("Invalid ROM path")
    return candidate


def _delete_file(stored_filename: str) -> None:
    try:
        _safe_path(stored_filename).unlink(missing_ok=True)
    except (OSError, RomValidationError):
        pass


def _stream_to_file(source: BinaryIO, relative_path: str, max_bytes: int, too_large_message: str) -> int:
    """Streams `source` to <rom dir>/<relative_path> via a .part file, enforcing max_bytes.
    Returns the size written; leaves nothing behind on failure."""
    final_path = _safe_path(relative_path)
    final_path.parent.mkdir(parents=True, exist_ok=True)
    part_path = final_path.with_name(final_path.name + ".part")
    size = 0
    try:
        with part_path.open("wb") as out:
            while chunk := source.read(_CHUNK_SIZE):
                size += len(chunk)
                if size > max_bytes:
                    raise RomTooLargeError(too_large_message)
                out.write(chunk)
        if size == 0:
            raise RomValidationError("File is empty")
        part_path.replace(final_path)
    except BaseException:
        part_path.unlink(missing_ok=True)
        raise
    return size


def stream_to_rom_dir(source: BinaryIO, relative_path: str, max_bytes: int, too_large_message: str) -> int:
    """Public wrapper over _stream_to_file for other private-storage users (bios_service)."""
    return _stream_to_file(source, relative_path, max_bytes, too_large_message)


def rom_dir_path(relative_path: str) -> Path:
    """Resolved path of a file under the private ROM dir, refusing anything outside it."""
    return _safe_path(relative_path)


def save_files_of(rom: RomFile) -> list[str]:
    """Every save file hanging off a ROM — its states, their screenshots, its in-game save."""
    files: list[str] = []
    for state in rom.save_states:
        files.append(state.stored_filename)
        if state.screenshot_filename:
            files.append(state.screenshot_filename)
    if rom.sram_stored_filename:
        files.append(rom.sram_stored_filename)
    return files


def _all_files_of(rom: RomFile) -> list[str]:
    return [rom.stored_filename, *save_files_of(rom)]


def _first_rom_like(names: list[str]) -> str:
    """The extension of the first ROM-looking entry in an archive listing. Falls back to the
    generic archive marker when nothing inside looks like a known ROM/disc file — e.g. an
    abandonware DOS game folder, which cores such as DOSBox Pure take as the archive itself."""
    for name in names:
        parts = PurePosixPath(name.replace("\\", "/")).parts
        if name.endswith("/") or not parts or parts[0] == "__MACOSX" or parts[-1].startswith("."):
            continue
        extension = _extension_of(name)
        if extension in emulation_cores.ROM_CONTENT_EXTENSIONS:
            return extension
    return emulation_cores.ARCHIVE_EXTENSION


def _detect_archive_content_extension(path: Path, archive_extension: str) -> str:
    """Lists an uploaded archive's contents without extracting anything and returns the
    playable file's extension (see _first_rom_like)."""
    if archive_extension == "7z":
        try:
            import py7zr

            with py7zr.SevenZipFile(path, mode="r") as archive:
                names = archive.getnames()
        except Exception as exc:  # py7zr raises several unrelated types for a bad archive
            raise RomValidationError("Not a valid 7z file") from exc
    else:
        try:
            with zipfile.ZipFile(path) as archive:
                names = archive.namelist()
        except zipfile.BadZipFile as exc:
            raise RomValidationError("Not a valid zip file") from exc
    return _first_rom_like(names)


def _require_item(db: Session, item_id: int) -> LibraryItem:
    item = library_item_repository.get_library_item(db, item_id)
    if item is None:
        raise NotFoundError(f"Library item {item_id} not found")
    return item


def _clean_label(label: str | None) -> str | None:
    label = (label or "").strip()
    return label[:100] or None


def _ingest_rom_upload(item: LibraryItem, source: BinaryIO, original_filename: str) -> dict:
    """Validates and streams an uploaded ROM to disk (never read whole into memory — disc
    images run to hundreds of MB) and returns the RomFile column values for it. Leaves
    nothing on disk if it fails."""
    if not can_hold_rom(item.status, item.format):
        raise RomValidationError("ROMs can only be attached to owned copies with a ROM, Abandonware, or ISO format")
    # Only platforms a bundled core plays take uploads — a ROM for anything else could never
    # be played here, so there's no point storing it.
    platform = item.platform
    if emulation_cores.core_for_platform(platform.slug if platform else None) is None:
        name = platform.name if platform else "This platform"
        raise RomValidationError(f"{name} can't be played in the browser, so ROMs can't be uploaded for it")

    original_filename = PurePosixPath(original_filename.replace("\\", "/")).name.strip()
    extension = _extension_of(original_filename)
    allowed = emulation_cores.ALLOWED_UPLOAD_EXTENSIONS[item.format]  # type: ignore[index]
    if not original_filename or extension not in allowed:
        raise RomValidationError(
            f"Unsupported file type for this format — allowed: {', '.join(sorted('.' + e for e in allowed))}"
        )

    stored_filename = uuid.uuid4().hex
    limit_mb = get_settings().rom_max_upload_mb
    size = _stream_to_file(
        source, stored_filename, limit_mb * 1024 * 1024, f"File is larger than the {limit_mb} MB limit"
    )
    is_archive = extension in emulation_cores.ARCHIVE_EXTENSIONS
    try:
        content_extension = (
            _detect_archive_content_extension(_safe_path(stored_filename), extension) if is_archive else extension
        )
    except BaseException:
        _delete_file(stored_filename)
        raise
    return {
        "original_filename": original_filename[:255],
        "stored_filename": stored_filename,
        "size_bytes": size,
        "extension": content_extension,
        "is_archive": is_archive,
    }


def _commit_or_discard(db: Session, new_stored_filename: str) -> None:
    try:
        db.commit()
    except BaseException:
        db.rollback()
        _delete_file(new_stored_filename)
        raise


def add_rom(
    db: Session, item_id: int, source: BinaryIO, original_filename: str, label: str | None = None
) -> LibraryItem:
    """Adds another ROM to this copy (e.g. a second region or revision). Each ROM keeps its
    own save states and in-game save."""
    item = _require_item(db, item_id)
    values = _ingest_rom_upload(item, source, original_filename)
    db.add(RomFile(library_item_id=item.id, label=_clean_label(label), **values))
    _commit_or_discard(db, values["stored_filename"])
    db.refresh(item)
    return item


def replace_rom_file(db: Session, rom_id: int, source: BinaryIO, original_filename: str) -> LibraryItem:
    """Swaps one ROM's file. Its save states / in-game save were taken on the old file and are
    meaningless for the new one, so they go too (the dialog warns first)."""
    rom = get_rom(db, rom_id)
    item = rom.library_item
    values = _ingest_rom_upload(item, source, original_filename)
    old_files = _all_files_of(rom)
    rom.save_states.clear()
    rom.sram_stored_filename = None
    rom.sram_size_bytes = None
    rom.sram_updated_at = None
    for key, value in values.items():
        setattr(rom, key, value)
    _commit_or_discard(db, values["stored_filename"])
    delete_files(old_files)
    db.refresh(item)
    return item


def update_rom_label(db: Session, rom_id: int, label: str | None) -> LibraryItem:
    rom = get_rom(db, rom_id)
    rom.label = _clean_label(label)
    db.commit()
    db.refresh(rom.library_item)
    return rom.library_item


def delete_rom(db: Session, rom_id: int) -> None:
    rom = get_rom(db, rom_id)
    files = _all_files_of(rom)
    db.delete(rom)
    db.commit()
    delete_files(files)


def detach_roms(db: Session, item: LibraryItem) -> list[str]:
    """Removes all of the item's ROM rows and their save states (no commit) and returns every
    file name involved, for the caller to delete via delete_files() once its own
    transaction commits."""
    files = [f for rom in item.roms for f in _all_files_of(rom)]
    item.roms.clear()
    db.flush()
    return files


def delete_files(stored_filenames: list[str]) -> None:
    for stored_filename in stored_filenames:
        _delete_file(stored_filename)


def get_rom(db: Session, rom_id: int) -> RomFile:
    rom = db.get(RomFile, rom_id)
    if rom is None:
        raise NotFoundError(f"ROM {rom_id} not found")
    return rom


# --- Save states ----------------------------------------------------------------------------


def create_save_state(
    db: Session,
    rom_id: int,
    state: BinaryIO,
    screenshot: BinaryIO | None = None,
    screenshot_media_type: str | None = None,
) -> RomSaveState:
    rom = get_rom(db, rom_id)
    screenshot_extension = None
    if screenshot is not None:
        screenshot_extension = SCREENSHOT_EXTENSIONS.get((screenshot_media_type or "").split(";")[0].strip().lower())
        if screenshot_extension is None:
            raise RomValidationError("Screenshot must be a PNG, JPEG, or WebP image")

    token = uuid.uuid4().hex
    state_path = f"{STATES_SUBDIR}/{token}.state"
    size = _stream_to_file(state, state_path, MAX_STATE_BYTES, "Save state is larger than the 64 MB limit")
    written = [state_path]
    screenshot_path = None
    try:
        if screenshot is not None:
            screenshot_path = f"{STATES_SUBDIR}/{token}.{screenshot_extension}"
            _stream_to_file(
                screenshot, screenshot_path, MAX_SCREENSHOT_BYTES, "Screenshot is larger than the 5 MB limit"
            )
            written.append(screenshot_path)
        save_state = RomSaveState(
            rom_file_id=rom.id,
            stored_filename=state_path,
            screenshot_filename=screenshot_path,
            screenshot_media_type=screenshot_media_type.split(";")[0].strip().lower() if screenshot_path else None,
            size_bytes=size,
        )
        db.add(save_state)
        db.commit()
    except BaseException:
        db.rollback()
        delete_files(written)
        raise
    db.refresh(save_state)
    return save_state


def list_save_states(db: Session, rom_id: int) -> list[RomSaveState]:
    rom = get_rom(db, rom_id)
    return list(rom.save_states)


def get_save_state(db: Session, rom_id: int, state_id: int) -> RomSaveState:
    save_state = db.get(RomSaveState, state_id)
    if save_state is None or save_state.rom_file_id != rom_id:
        raise NotFoundError(f"Save state {state_id} not found")
    return save_state


def get_save_state_path(save_state: RomSaveState) -> Path:
    return _safe_path(save_state.stored_filename)


def get_screenshot_path(save_state: RomSaveState) -> Path | None:
    return _safe_path(save_state.screenshot_filename) if save_state.screenshot_filename else None


def delete_save_state(db: Session, rom_id: int, state_id: int) -> None:
    save_state = get_save_state(db, rom_id, state_id)
    files = [save_state.stored_filename]
    if save_state.screenshot_filename:
        files.append(save_state.screenshot_filename)
    db.delete(save_state)
    db.commit()
    delete_files(files)


# --- In-game (battery/SRAM) save --------------------------------------------------------------


def put_sram(db: Session, rom_id: int, source: BinaryIO) -> RomFile:
    """Replaces the ROM's in-game save. The old file is only removed once the new one is
    committed, so a failed sync never loses the previous save."""
    rom = get_rom(db, rom_id)
    path = f"{SAVES_SUBDIR}/{uuid.uuid4().hex}.sav"
    size = _stream_to_file(source, path, MAX_SRAM_BYTES, "In-game save is larger than the 16 MB limit")
    old = rom.sram_stored_filename
    rom.sram_stored_filename = path
    rom.sram_size_bytes = size
    rom.sram_updated_at = datetime.now(UTC)
    try:
        db.commit()
    except BaseException:
        db.rollback()
        delete_files([path])
        raise
    if old:
        delete_files([old])
    db.refresh(rom)
    return rom


def get_sram_path(db: Session, rom_id: int) -> Path:
    rom = get_rom(db, rom_id)
    if not rom.sram_stored_filename:
        raise NotFoundError(f"ROM {rom_id} has no in-game save")
    return _safe_path(rom.sram_stored_filename)


def delete_sram(db: Session, rom_id: int) -> None:
    rom = get_rom(db, rom_id)
    if not rom.sram_stored_filename:
        raise NotFoundError(f"ROM {rom_id} has no in-game save")
    old = rom.sram_stored_filename
    rom.sram_stored_filename = None
    rom.sram_size_bytes = None
    rom.sram_updated_at = None
    db.commit()
    delete_files([old])
