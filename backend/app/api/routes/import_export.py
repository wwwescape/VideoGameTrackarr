from collections.abc import Callable

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_session_factory
from app.schemas.backup import RestoreStatusResponse
from app.services import backup_service, csv_service, hardware_csv_service, restore_job

router = APIRouter(tags=["import-export"], dependencies=[Depends(get_current_user)])


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
def export_backup(db: Session = Depends(get_db)) -> Response:
    backup_json = backup_service.export_backup_json(db)
    return Response(
        content=backup_json,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="videogametrackarr-backup.json"'},
    )


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
    raw = await file.read()
    try:
        payload = backup_service.parse_backup_payload(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValidationError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Not a valid backup file: {exc}") from exc

    state = restore_job.start_restore(payload, session_factory)
    return _to_response(state)


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
