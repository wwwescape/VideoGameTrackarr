import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.health import HealthResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/healthz", response_model=HealthResponse)
def healthz(db: Session = Depends(get_db)) -> HealthResponse:
    try:
        db.execute(text("SELECT 1"))
        database_status = "ok"
    except Exception:
        logger.exception("Health check database probe failed")
        database_status = "error"

    return HealthResponse(status="ok", database=database_status)
