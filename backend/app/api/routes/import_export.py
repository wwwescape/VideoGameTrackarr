from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.backup import BackupRestoreResult
from app.services import backup_service, csv_service, hardware_csv_service

router = APIRouter(tags=["import-export"], dependencies=[Depends(get_current_user)])


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


@router.post("/api/import/backup", response_model=BackupRestoreResult)
async def restore_backup(file: UploadFile = File(...), db: Session = Depends(get_db)) -> BackupRestoreResult:
    raw = await file.read()
    try:
        payload = backup_service.parse_backup_payload(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValidationError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Not a valid backup file: {exc}") from exc

    return backup_service.restore_backup(db, payload)


@router.get("/api/export/hardware-csv")
def export_hardware_csv(db: Session = Depends(get_db)) -> Response:
    csv_text = hardware_csv_service.export_hardware_csv(db)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="videogametrackarr-hardware.csv"'},
    )
