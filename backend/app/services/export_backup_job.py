"""Scheduled backup export job — writes the data export to a network (SMB) share and
prunes old exports.

The user configures an SMB folder, credentials, how many exports to keep, and whether
exports are full backups (JSON + ROMs/saves/BIOS) or JSON-only. Each run uploads one
timestamped file, then deletes the oldest exports beyond the retention count.
"""

import re
import tempfile
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.system import User
from app.services import backup_service
from app.services.job_registry import JobDefinition

JOB_EXPORT_BACKUP = "export_backup"

EXPORT_FILENAME_PREFIX = "videogametrackarr-backup-"
# Scheduled exports are named videogametrackarr-backup-YYYYMMDD-HHMMSS.(json|zip).
# Manual exports (videogametrackarr-backup.json, videogametrackarr-full-backup.zip) are
# also pruned — anything looking like one of our backup files counts.
EXPORT_FILENAME_RE = re.compile(r"^videogametrackarr-(full-)?backup.*\.(json|zip)$", re.IGNORECASE)


class ExportBackupError(Exception):
    """Raised for export-backup configuration or SMB problems — surfaced to the user
    as a clear message, not a traceback."""


def _parse_smb_path(smb_path: str) -> tuple[str, str, str]:
    """Parses an SMB path into (server, share, subpath). Accepts Windows UNC
    (\\\\server\\share\\path) and smb:// URLs (smb://server/share/path)."""
    path = smb_path.strip()
    if path.lower().startswith("smb://"):
        path = path[6:]
        parts = [p for p in path.split("/") if p]
    else:
        path = path.lstrip("\\")
        parts = [p for p in re.split(r"[\\/]", path) if p]

    if len(parts) < 2:
        raise ExportBackupError(
            f"Invalid network path {smb_path!r} — expected \\\\server\\share\\folder or smb://server/share/folder."
        )
    server, share = parts[0], parts[1]
    subpath = "\\".join(parts[2:])
    return server, share, subpath


def _require_smbprotocol() -> None:
    try:
        import smbprotocol  # noqa: F401
    except ImportError as exc:
        raise ExportBackupError(
            "The 'smbprotocol' package is required for network-share exports — install it with "
            "'pip install smbprotocol' and restart."
        ) from exc


def test_connection(smb_path: str, username: str | None, password: str | None) -> None:
    """Tries to connect to the SMB server and access the share — raises ExportBackupError
    with a clear message if anything fails. Does not write anything."""
    _require_smbprotocol()
    from smbprotocol.connection import Connection
    from smbprotocol.session import Session
    from smbprotocol.tree import TreeConnect

    if not smb_path or not smb_path.strip():
        raise ExportBackupError("Enter the network folder location first.")

    server, share, _subpath = _parse_smb_path(smb_path)

    connection = Connection(uuid.uuid4(), server, 445)
    try:
        connection.connect(timeout=15)
    except Exception as exc:
        raise ExportBackupError(f"Could not connect to server {server!r}: {exc}") from exc

    try:
        session = Session(connection, username or "", password or "")
        try:
            session.connect()
        except Exception as exc:
            raise ExportBackupError(f"Authentication failed for {server!r}: {exc}") from exc

        tree = TreeConnect(session, f"\\\\{server}\\{share}")
        try:
            tree.connect()
        except Exception as exc:
            raise ExportBackupError(f"Could not access share {share!r} on {server!r}: {exc}") from exc
    finally:
        connection.disconnect()


def _connect(smb_path: str, username: str | None, password: str | None) -> tuple[Any, Any, str]:
    """Opens an SMB connection and returns (connection, tree, subpath). Caller must
    disconnect the connection in a finally block."""
    _require_smbprotocol()
    from smbprotocol.connection import Connection
    from smbprotocol.session import Session
    from smbprotocol.tree import TreeConnect

    server, share, subpath = _parse_smb_path(smb_path)

    connection = Connection(uuid.uuid4(), server, 445)
    try:
        connection.connect(timeout=30)
    except Exception as exc:
        raise ExportBackupError(f"Could not connect to server {server!r}: {exc}") from exc

    try:
        session = Session(connection, username or "", password or "")
        try:
            session.connect()
        except Exception as exc:
            raise ExportBackupError(f"Authentication failed for {server!r}: {exc}") from exc

        tree = TreeConnect(session, f"\\\\{server}\\{share}")
        try:
            tree.connect()
        except Exception as exc:
            raise ExportBackupError(f"Could not access share {share!r} on {server!r}: {exc}") from exc
    except Exception:
        connection.disconnect()
        raise

    return connection, tree, subpath


def _remote_path(subpath: str, filename: str) -> str:
    return f"{subpath}\\{filename}" if subpath else filename


def _upload_file(tree: Any, remote_path: str, local_path: Path, report_progress: Callable[[int, int], None]) -> None:
    """Uploads a local file to the SMB share, reporting progress as it goes."""
    from smbprotocol.open import (
        CreateDisposition,
        CreateOptions,
        FileAttributes,
        FilePipePrinterAccessMask,
        ImpersonationLevel,
        Open,
        ShareAccess,
    )

    total = local_path.stat().st_size
    try:
        remote = Open(tree, remote_path)
        remote.create(
            ImpersonationLevel.Impersonation,
            FilePipePrinterAccessMask.FILE_WRITE_DATA,
            FileAttributes.FILE_ATTRIBUTE_NORMAL,
            ShareAccess.FILE_SHARE_READ,
            CreateDisposition.FILE_OVERWRITE_IF,
            CreateOptions.FILE_NON_DIRECTORY_FILE,
        )
    except Exception as exc:
        raise ExportBackupError(f"Could not create {remote_path!r} on the share: {exc}") from exc

    try:
        offset = 0
        with open(local_path, "rb") as f:
            while True:
                chunk = f.read(1024 * 1024)
                if not chunk:
                    break
                try:
                    remote.write(chunk, offset)
                except Exception as exc:
                    raise ExportBackupError(f"Failed writing to {remote_path!r}: {exc}") from exc
                offset += len(chunk)
                report_progress(min(offset, total), total)
    finally:
        remote.close()


def _sort_key(name: str) -> tuple[int, str]:
    """Orders backup files oldest-first. Timestamped scheduled exports sort by their
    timestamp; manual exports without a timestamp are treated as oldest."""
    m = re.match(r"^videogametrackarr-backup-(\d{8})-(\d{6})\.(json|zip)$", name, re.IGNORECASE)
    if m:
        return (1, m.group(1) + m.group(2))
    return (0, "")


def _list_export_files(tree: Any, subpath: str) -> list[str]:
    """Lists backup files in the share folder, oldest first."""
    from smbprotocol.file_info import FileInformationClass
    from smbprotocol.open import (
        CreateDisposition,
        CreateOptions,
        FileAttributes,
        FilePipePrinterAccessMask,
        ImpersonationLevel,
        Open,
        ShareAccess,
    )

    try:
        directory = Open(tree, subpath if subpath else "\\")
        directory.create(
            ImpersonationLevel.Impersonation,
            FilePipePrinterAccessMask.FILE_READ_DATA,
            FileAttributes.FILE_ATTRIBUTE_DIRECTORY,
            ShareAccess.FILE_SHARE_READ | ShareAccess.FILE_SHARE_WRITE,
            CreateDisposition.FILE_OPEN,
            CreateOptions.FILE_DIRECTORY_FILE,
        )
    except Exception as exc:
        raise ExportBackupError(f"Could not list the export folder: {exc}") from exc

    try:
        names = []
        for entry in directory.query_directory("*", FileInformationClass.FILE_NAMES_INFORMATION):
            # file_name is a BytesField holding the UTF-16-LE encoded name.
            raw = entry["file_name"].get_value()
            names.append(raw.decode("utf-16-le") if isinstance(raw, bytes) else str(raw))
    except Exception as exc:
        raise ExportBackupError(f"Could not list the export folder: {exc}") from exc
    finally:
        directory.close()

    matched = [n for n in names if EXPORT_FILENAME_RE.match(n)]
    matched.sort(key=_sort_key)
    return matched


def _delete_file(tree: Any, remote_path: str) -> None:
    from smbprotocol.open import (
        CreateDisposition,
        CreateOptions,
        FileAttributes,
        FilePipePrinterAccessMask,
        ImpersonationLevel,
        Open,
        ShareAccess,
    )

    try:
        remote = Open(tree, remote_path)
        remote.create(
            ImpersonationLevel.Impersonation,
            FilePipePrinterAccessMask.FILE_READ_DATA | FilePipePrinterAccessMask.DELETE,
            FileAttributes.FILE_ATTRIBUTE_NORMAL,
            ShareAccess.FILE_SHARE_READ | ShareAccess.FILE_SHARE_WRITE | ShareAccess.FILE_SHARE_DELETE,
            CreateDisposition.FILE_OPEN,
            CreateOptions.FILE_NON_DIRECTORY_FILE | CreateOptions.FILE_DELETE_ON_CLOSE,
        )
        remote.close()
    except Exception as exc:
        raise ExportBackupError(f"Could not delete old export {remote_path!r}: {exc}") from exc


def get_config(user: User) -> dict[str, Any]:
    """The export-job config for API responses — the password itself is never returned."""
    return {
        "smb_path": user.export_smb_path,
        "smb_username": user.export_smb_username,
        "has_password": bool(user.export_smb_password),
        "retention_count": user.export_retention_count,
        "include_files": bool(user.export_include_files),
    }


def set_config(
    db: Session,
    user: User,
    smb_path: str | None,
    smb_username: str | None,
    smb_password: str | None,
    retention_count: int | None,
    include_files: bool,
) -> None:
    """Updates the export-job config. None clears a field; an empty password keeps the
    saved one (same convention as the Playnite config)."""
    user.export_smb_path = smb_path.strip() if smb_path and smb_path.strip() else None
    user.export_smb_username = smb_username.strip() if smb_username and smb_username.strip() else None
    if smb_password:
        user.export_smb_password = smb_password
    elif smb_password is not None:
        # Explicit empty string clears it.
        user.export_smb_password = None
    if retention_count is not None:
        if retention_count < 1:
            raise ExportBackupError("Keep at least 1 export.")
        user.export_retention_count = retention_count
    user.export_include_files = bool(include_files)
    db.commit()


def run(
    session_factory: Callable[[], Session],
    report_progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    db = session_factory()
    try:
        return _export(db, report_progress or (lambda current, total: None))
    finally:
        db.close()


def _export(db: Session, report_progress: Callable[[int, int], None]) -> dict[str, Any]:
    user = db.scalars(select(User)).first()
    if user is None:
        raise ExportBackupError("No user account found.")
    if not user.export_smb_path:
        raise ExportBackupError(
            "The scheduled export isn't configured yet — set the network folder in Settings → Jobs."
        )
    retention = user.export_retention_count or 5
    include_files = bool(user.export_include_files)

    # 1. Build the export locally.
    timestamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    extension = "zip" if include_files else "json"
    filename = f"{EXPORT_FILENAME_PREFIX}{timestamp}.{extension}"
    if include_files:
        local_path = backup_service.export_full_backup_zip(db)
    else:
        backup_json = backup_service.export_backup_json(db)
        handle, name = tempfile.mkstemp(prefix="vgt-scheduled-backup-", suffix=".json")
        with open(handle, "w", encoding="utf-8") as f:
            f.write(backup_json)
        local_path = Path(name)

    try:
        # 2. Upload it to the share.
        connection, tree, subpath = _connect(
            user.export_smb_path, user.export_smb_username, user.export_smb_password
        )
        try:
            report_progress(0, 100)
            _upload_file(tree, _remote_path(subpath, filename), local_path, report_progress)

            # 3. Prune old exports beyond the retention count.
            existing = _list_export_files(tree, subpath)
            # The file we just uploaded is the newest; drop extras oldest-first.
            to_delete = existing[: max(0, len(existing) - retention)] if len(existing) > retention else []
            deleted = 0
            for old_name in to_delete:
                _delete_file(tree, _remote_path(subpath, old_name))
                deleted += 1
        finally:
            connection.disconnect()
    finally:
        local_path.unlink(missing_ok=True)

    return {
        "succeeded": 1,
        "failed": 0,
        "total": 1,
        "failures": [],
        "filename": filename,
        "deleted": deleted,
    }


DEFINITION_EXPORT_BACKUP = JobDefinition(id=JOB_EXPORT_BACKUP, run=run)
