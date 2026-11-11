from datetime import datetime
from typing import Any

from app.models.jobs import JobRunLog, JobSchedule
from app.schemas.base import CamelModel
from app.services.job_registry import JobRunState


class JobProgressResponse(CamelModel):
    current: int
    total: int


class JobRunResponse(CamelModel):
    status: str
    started_at: str | None
    finished_at: str | None
    result: dict[str, Any] | None
    error: str | None
    progress: JobProgressResponse | None


class JobScheduleResponse(CamelModel):
    enabled: bool
    cron_expression: str | None
    next_run_at: str | None
    # The zone cron expressions are evaluated in (TZ env var, else the server's own zone).
    timezone: str


class JobRunLogSummaryResponse(CamelModel):
    id: int
    trigger: str
    status: str
    started_at: str
    finished_at: str | None
    result: dict[str, Any] | None
    error: str | None


class JobRunLogLine(CamelModel):
    t: str
    level: str
    msg: str


class JobRunLogResponse(JobRunLogSummaryResponse):
    lines: list[JobRunLogLine]


class JobSummaryResponse(CamelModel):
    id: str
    run: JobRunResponse
    schedule: JobScheduleResponse
    last_run: JobRunLogSummaryResponse | None


class JobScheduleUpdateRequest(CamelModel):
    enabled: bool
    cron_expression: str | None = None


def job_run_from_state(state: JobRunState) -> JobRunResponse:
    return JobRunResponse(
        status=state.status.value,
        started_at=state.started_at.isoformat() if state.started_at else None,
        finished_at=state.finished_at.isoformat() if state.finished_at else None,
        result=state.result,
        error=state.error,
        progress=JobProgressResponse(current=state.progress.current, total=state.progress.total)
        if state.progress
        else None,
    )


def job_schedule_from_orm(
    schedule: JobSchedule | None, next_run_at: datetime | None, timezone: str
) -> JobScheduleResponse:
    return JobScheduleResponse(
        enabled=schedule.enabled if schedule else False,
        cron_expression=schedule.cron_expression if schedule else None,
        next_run_at=next_run_at.isoformat() if next_run_at else None,
        timezone=timezone,
    )


def _log_fields(log: JobRunLog) -> dict[str, Any]:
    return {
        "id": log.id,
        "trigger": log.trigger,
        "status": log.status,
        "started_at": log.started_at.isoformat(),
        "finished_at": log.finished_at.isoformat() if log.finished_at else None,
        "error": log.error,
    }


def job_run_log_summary(log: JobRunLog) -> JobRunLogSummaryResponse:
    # The full result can carry a long failures list; the run list only needs the counts.
    result = {key: value for key, value in (log.result or {}).items() if key != "failures"} or None
    return JobRunLogSummaryResponse(**_log_fields(log), result=result)


def job_run_log_detail(log: JobRunLog, lines: list[dict[str, str]]) -> JobRunLogResponse:
    return JobRunLogResponse(
        **_log_fields(log), result=log.result, lines=[JobRunLogLine(**line) for line in lines]
    )
