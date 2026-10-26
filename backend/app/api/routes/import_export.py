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
from app.schemas.base import CamelModel
from app.services import backup_service, csv_service, export_backup_job, hardware_csv_service, restore_job
from app.services.export_backup_job import ExportBackupError

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


class ExportJobConfigRequest(CamelModel):
    # All optional — None clears the stored value. An empty password string also clears
    # it; None leaves the existing password untouched.
    smb_path: str | None = None
    smb_username: str | None = None
    smb_password: str | None = None
    retention_count: int | None = None
    include_files: bool = False


class ExportJobConfigResponse(CamelModel):
    smb_path: str | None
    smb_username: str | None
    # Never expose the actual password — only whether one is stored.
    has_password: bool
    retention_count: int | None
    include_files: bool


class ExportJobTestRequest(CamelModel):
    smb_path: str | None = None
    smb_username: str | None = None
    smb_password: str | None = None


class ExportJobTestResponse(CamelModel):
    ok: bool
    message: str


@router.get("/api/export/job-config", response_model=ExportJobConfigResponse)
def get_export_job_config(current_user: User = Depends(get_current_user)) -> ExportJobConfigResponse:
    return ExportJobConfigResponse(**export_backup_job.get_config(current_user))


@router.put("/api/export/job-config", response_model=ExportJobConfigResponse)
def update_export_job_config(
    payload: ExportJobConfigRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExportJobConfigResponse:
    try:
        export_backup_job.set_config(
            db,
            current_user,
            smb_path=payload.smb_path,
            smb_username=payload.smb_username,
            smb_password=payload.smb_password,
            retention_count=payload.retention_count,
            include_files=payload.include_files,
        )
    except ExportBackupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ExportJobConfigResponse(**export_backup_job.get_config(current_user))


@router.post("/api/export/job-config/test", response_model=ExportJobTestResponse)
def test_export_job_connection(
    payload: ExportJobTestRequest,
    current_user: User = Depends(get_current_user),
) -> ExportJobTestResponse:
    # Blank fields fall back to the saved config, so testing works without retyping
    # the password every time.
    saved = export_backup_job.get_config(current_user)
    smb_path = payload.smb_path or saved.get("smb_path")
    smb_username = payload.smb_username if payload.smb_username is not None else saved.get("smb_username")
    smb_password = payload.smb_password or current_user.export_smb_password
    try:
        export_backup_job.test_connection(smb_path or "", smb_username, smb_password)
    except ExportBackupError as exc:
        return ExportJobTestResponse(ok=False, message=str(exc))
    return ExportJobTestResponse(ok=True, message="Connection successful.")
