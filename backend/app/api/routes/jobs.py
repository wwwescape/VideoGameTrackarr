from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_session_factory
from app.schemas.job import (
    JobScheduleUpdateRequest,
    JobSummaryResponse,
    job_run_from_state,
    job_schedule_from_orm,
)
from app.services import job_registry, job_schedule_service, job_scheduler

router = APIRouter(prefix="/api/jobs", tags=["jobs"], dependencies=[Depends(get_current_user)])


def _to_summary(db: Session, job_id: str) -> JobSummaryResponse:
    run = job_run_from_state(job_registry.get_state(job_id))
    schedule = job_schedule_from_orm(
        job_schedule_service.get_schedule(db, job_id), job_scheduler.get_next_run_time(job_id)
    )
    return JobSummaryResponse(id=job_id, run=run, schedule=schedule)


@router.get("", response_model=list[JobSummaryResponse])
def list_jobs(db: Session = Depends(get_db)) -> list[JobSummaryResponse]:
    return [_to_summary(db, definition.id) for definition in job_registry.list_jobs()]


@router.get("/{job_id}/status", response_model=JobSummaryResponse)
def get_job_status(job_id: str, db: Session = Depends(get_db)) -> JobSummaryResponse:
    return _to_summary(db, job_id)


@router.post("/{job_id}/run", response_model=JobSummaryResponse, status_code=status.HTTP_202_ACCEPTED)
def run_job(
    job_id: str,
    db: Session = Depends(get_db),
    session_factory: Callable[[], Session] = Depends(get_session_factory),
) -> JobSummaryResponse:
    job_registry.trigger_run(job_id, session_factory)
    return _to_summary(db, job_id)


@router.post("/{job_id}/status/acknowledge", status_code=status.HTTP_204_NO_CONTENT)
def acknowledge_job_status(job_id: str) -> None:
    job_registry.acknowledge(job_id)


@router.put("/{job_id}/schedule", response_model=JobSummaryResponse)
def update_job_schedule(
    job_id: str,
    payload: JobScheduleUpdateRequest,
    db: Session = Depends(get_db),
    session_factory: Callable[[], Session] = Depends(get_session_factory),
) -> JobSummaryResponse:
    # get_state 404s on an unregistered job_id before we bother validating/persisting a
    # schedule for something job_registry doesn't know about.
    job_registry.get_state(job_id)
    try:
        job_schedule_service.update_schedule(db, job_id, payload.enabled, payload.cron_expression, session_factory)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_summary(db, job_id)
