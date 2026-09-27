"""Console BIOS files the user uploads for the emulator cores that need one (Settings →
Emulation). Which systems exist, which filenames each accepts, and which dumps are known-good
all come from emulation_cores.BIOS_SYSTEMS; this module only stores and serves the files.

Files live under <ROM dir>/bios/ — private like the ROMs themselves (the public /uploads mount
refuses the whole ROM dir) and only served to the player through short-lived signed URLs."""

import hashlib
import uuid
from pathlib import Path, PurePosixPath
from typing import BinaryIO

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.library import BiosFile
from app.services import emulation_cores, rom_service
from app.services.exceptions import NotFoundError

BIOS_SUBDIR = "bios"
MAX_BIOS_BYTES = 64 * 1024 * 1024


def require_system(system: str) -> emulation_cores.BiosSystem:
    bios_system = emulation_cores.BIOS_SYSTEMS.get(system)
    if bios_system is None:
        raise NotFoundError(f"Unknown BIOS system {system}")
    return bios_system


def list_files(db: Session) -> list[BiosFile]:
    return list(db.scalars(select(BiosFile).order_by(BiosFile.system, BiosFile.filename)))


def files_for_system(db: Session, system: str) -> list[BiosFile]:
    return list(db.scalars(select(BiosFile).where(BiosFile.system == system).order_by(BiosFile.filename)))


def ready_systems(db: Session) -> frozenset[str]:
    """BIOS systems with at least one file that satisfies them uploaded — what
    emulation_cores.resolve_playability needs to decide MISSING_BIOS."""
    ready = set()
    for bios_file in list_files(db):
        system = emulation_cores.BIOS_SYSTEMS.get(bios_file.system)
        spec = system.spec_for(bios_file.filename) if system else None
        if spec is not None and spec.satisfies:
            ready.add(bios_file.system)
    return frozenset(ready)


def is_recognized(bios_file: BiosFile) -> bool:
    system = emulation_cores.BIOS_SYSTEMS.get(bios_file.system)
    spec = system.spec_for(bios_file.filename) if system else None
    return spec is not None and bios_file.md5.lower() in spec.md5s


def upload(db: Session, system: str, source: BinaryIO, original_filename: str) -> BiosFile:
    """Stores the file under its system, replacing any earlier file with the same accepted
    name. The name must be one the core looks for — it's written under exactly that name for
    the core to find. The MD5 is recorded to show whether it's a known-good dump; an unknown
    dump is still accepted (regional or revision differences are common)."""
    bios_system = require_system(system)
    name = PurePosixPath(original_filename.replace("\\", "/")).name.strip()
    spec = bios_system.spec_for(name)
    if spec is None:
        accepted = ", ".join(f.filename for f in bios_system.files)
        raise rom_service.RomValidationError(f"{bios_system.label} BIOS files must be named one of: {accepted}")

    stored_filename = f"{BIOS_SUBDIR}/{uuid.uuid4().hex}"
    size = rom_service.stream_to_rom_dir(source, stored_filename, MAX_BIOS_BYTES, "BIOS file is larger than 64 MB")
    md5 = hashlib.md5(rom_service.rom_dir_path(stored_filename).read_bytes()).hexdigest()

    existing = db.scalars(
        select(BiosFile).where(BiosFile.system == system, BiosFile.filename == spec.filename)
    ).first()
    old_stored = existing.stored_filename if existing else None
    bios_file = existing or BiosFile(system=system, filename=spec.filename)
    bios_file.stored_filename = stored_filename
    bios_file.size_bytes = size
    bios_file.md5 = md5
    if existing is None:
        db.add(bios_file)
    try:
        db.commit()
    except BaseException:
        db.rollback()
        rom_service.delete_files([stored_filename])
        raise
    if old_stored:
        rom_service.delete_files([old_stored])
    db.refresh(bios_file)
    return bios_file


def get_file(db: Session, bios_id: int) -> BiosFile:
    bios_file = db.get(BiosFile, bios_id)
    if bios_file is None:
        raise NotFoundError(f"BIOS file {bios_id} not found")
    return bios_file


def file_path(bios_file: BiosFile) -> Path:
    return rom_service.rom_dir_path(bios_file.stored_filename)


def delete(db: Session, bios_id: int) -> None:
    bios_file = get_file(db, bios_id)
    stored = bios_file.stored_filename
    db.delete(bios_file)
    db.commit()
    rom_service.delete_files([stored])
