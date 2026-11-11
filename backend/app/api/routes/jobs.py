from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_session_factory
from app.schemas.job import (
    JobRunLogResponse,
    JobRunLogSummaryResponse,
    JobScheduleUpdateRequest,
    JobSummaryResponse,
    job_run_from_state,
    job_run_log_detail,
    job_run_log_summary,
    job_schedule_from_orm,
)
from app.services import job_registry, job_run_log_service, job_schedule_service, job_scheduler

router = APIRouter(prefix="/api/jobs", tags=["jobs"], dependencies=[Depends(get_current_user)])


def _to_summary(db: Session, job_id: str) -> JobSummaryResponse:
    run = job_run_from_state(job_registry.get_state(job_id))
    schedule = job_schedule_from_orm(
        job_schedule_service.get_schedule(db, job_id),
        job_scheduler.get_next_run_time(job_id),
        job_scheduler.timezone_name(),
    )
    latest = job_run_log_service.latest(db, job_id)
    return JobSummaryResponse(
        id=job_id,
        run=run,
        schedule=schedule,
        last_run=job_run_log_summary(latest) if latest else None,
    )


@router.get("", response_model=list[JobSummaryResponse])
def list_jobs(db: Session = Depends(get_db)) -> list[JobSummaryResponse]:
    return [_to_summary(db, definition.id) for definition in job_registry.list_jobs() if definition.listed]


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


@router.get("/{job_id}/logs", response_model=list[JobRunLogSummaryResponse])
def list_job_logs(job_id: str, db: Session = Depends(get_db)) -> list[JobRunLogSummaryResponse]:
    job_registry.get_state(job_id)
    return [job_run_log_summary(log) for log in job_run_log_service.list_logs(db, job_id)]


@router.get("/{job_id}/logs/{log_id}", response_model=JobRunLogResponse)
def get_job_log(job_id: str, log_id: int, db: Session = Depends(get_db)) -> JobRunLogResponse:
    job_registry.get_state(job_id)
    log = job_run_log_service.get_log(db, job_id, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Log not found")
    # A run still in progress has its lines in memory until it finishes.
    lines = job_run_log_service.live_lines(log.id)
    return job_run_log_detail(log, lines if lines is not None else (log.lines or []))


@router.delete("/{job_id}/logs", status_code=status.HTTP_204_NO_CONTENT)
def clear_job_logs(job_id: str, db: Session = Depends(get_db)) -> None:
    """Deletes every finished log of the job; a run in progress keeps its log."""
    job_registry.get_state(job_id)
    job_run_log_service.clear_logs(db, job_id)
