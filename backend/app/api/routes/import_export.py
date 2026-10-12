import os
import tempfile
from collections.abc import Callable
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from pydantic import ValidationError
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from app.api.deps import get_current_user, get_db, get_session_factory
from app.core.security import TokenError, TokenType, create_backup_download_token, decode_token
from app.models.system import User
from app.schemas.backup import FullBackupLinkResponse, RestoreStatusResponse
from app.schemas.csv_import import CsvImportResult
from app.services import backup_service, csv_service, hardware_csv_service, restore_job

router = APIRouter(tags=["import-export"], dependencies=[Depends(get_current_user)])
# Reached by a plain browser navigation with a signed token in the path (no auth header).
download_router = APIRouter(tags=["import-export"])


def _to_response(state: restore_job.RestoreJobState) -> RestoreStatusResponse:
    return RestoreStatusResponse(
        status=state.status.value,
        started_at=state.started_at.isoformat() if state.started_at else None,
        finished_at=state.finished_at.isoformat() if state.finished_at else None,
        result=state.result,
        error=state.error,
    )


@router.get("/api/export/csv")
def export_csv(db: Session = Depends(get_db)) -> Response:
    csv_text = csv_service.export_csv(db)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="videogametrackarr-library.csv"'},
    )


@router.get("/api/export/backup")
def export_backup(full: bool = False, db: Session = Depends(get_db)) -> Response:
    """The JSON backup, or with ?full=true a .zip that also carries every ROM, save and BIOS
    file (built in a temp file that's deleted once it has been sent)."""
    if full:
        return _full_backup_response(db)
    backup_json = backup_service.export_backup_json(db)
    return Response(
        content=backup_json,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="videogametrackarr-backup.json"'},
    )


def _full_backup_response(db: Session) -> FileResponse:
    path = backup_service.export_full_backup_zip(db)
    return FileResponse(
        path,
        media_type="application/zip",
        filename="videogametrackarr-full-backup.zip",
        background=BackgroundTask(path.unlink, missing_ok=True),
    )


@router.post("/api/export/backup/full-link", response_model=FullBackupLinkResponse)
def create_full_backup_link(current_user: User = Depends(get_current_user)) -> FullBackupLinkResponse:
    token = create_backup_download_token(current_user.id)
    return FullBackupLinkResponse(url=f"/api/export/backup/full/{token}/videogametrackarr-full-backup.zip")


@download_router.get("/api/export/backup/full/{token}/{filename}")
def download_full_backup(token: str, filename: str, db: Session = Depends(get_db)) -> FileResponse:
    try:
        payload = decode_token(token, TokenType.BACKUP_DOWNLOAD)
    except TokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired download link") from exc
    if db.get(User, int(payload["sub"])) is None:
        raise HTTPException(status_code=401, detail="Invalid or expired download link")
    return _full_backup_response(db)


@router.post("/api/import/csv", response_model=CsvImportResult)
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)) -> CsvImportResult:
    """Import library items from a CSV file.

    Columns must be in export order: name, category, status, platform, region, format,
    edition, acquired_at, notes. A header row with those exact names is optional.
    Rows are validated individually — a bad row is skipped (reported in `errors`) while
    the rest still import. Nothing is wiped: this adds to the library, unlike restore.
    """
    raw = await file.read()
    try:
        csv_text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Not a valid UTF-8 CSV file: {exc}") from exc
    return csv_service.import_csv(db, csv_text)


@router.post("/api/import/backup", response_model=RestoreStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def restore_backup(
    file: UploadFile = File(...),
    session_factory: Callable[[], Session] = Depends(get_session_factory),
) -> RestoreStatusResponse:
    """Kicks off the restore as a background job and returns immediately — a full restore
    can take minutes, so the response no longer blocks for it. Callers poll
    GET /api/import/backup/status for progress; a second restore while one is already
    running raises ConflictError (see restore_job.start_restore), surfaced as 409 by the
    app-wide handler in app/main.py."""
    head = await file.read(4)
    await file.seek(0)
    if head.startswith(b"PK") or (file.filename or "").lower().endswith(".zip"):
        return _to_response(await _start_full_restore(file, session_factory))

    raw = await file.read()
    try:
        payload = backup_service.parse_backup_payload(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValidationError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Not a valid backup file: {exc}") from exc

    state = restore_job.start_restore(payload, session_factory)
    return _to_response(state)


async def _start_full_restore(
    file: UploadFile, session_factory: Callable[[], Session]
) -> restore_job.RestoreJobState:
    """A full-backup .zip can be many GB, so it's streamed to a temp file rather than read
    into memory; the restore job deletes it when it finishes."""
    handle, name = tempfile.mkstemp(prefix="vgt-restore-", suffix=".zip")
    path = Path(name)
    try:
        with os.fdopen(handle, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                out.write(chunk)
        try:
            payload = backup_service.read_full_backup_zip(path)
        except (UnicodeDecodeError, ValidationError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=f"Not a valid backup file: {exc}") from exc
        return restore_job.start_restore(payload, session_factory, files_zip=path)
    except BaseException:
        path.unlink(missing_ok=True)
        raise


@router.get("/api/import/backup/status", response_model=RestoreStatusResponse)
def restore_backup_status() -> RestoreStatusResponse:
    return _to_response(restore_job.get_state())


@router.post("/api/import/backup/status/acknowledge", status_code=status.HTTP_204_NO_CONTENT)
def acknowledge_restore_backup_status() -> None:
    restore_job.acknowledge()


@router.get("/api/export/hardware-csv")
def export_hardware_csv(db: Session = Depends(get_db)) -> Response:
    csv_text = hardware_csv_service.export_hardware_csv(db)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="videogametrackarr-hardware.csv"'},
    )
