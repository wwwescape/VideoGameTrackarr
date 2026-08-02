from datetime import datetime
from typing import Any

from app.models.jobs import JobSchedule
from app.schemas.base import CamelModel
from app.services.job_registry import JobRunState


class JobRunResponse(CamelModel):
    status: str
    started_at: str | None
    finished_at: str | None
    result: dict[str, Any] | None
    error: str | None


class JobScheduleResponse(CamelModel):
    enabled: bool
    cron_expression: str | None
    next_run_at: str | None


class JobSummaryResponse(CamelModel):
    id: str
    run: JobRunResponse
    schedule: JobScheduleResponse


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
    )


def job_schedule_from_orm(schedule: JobSchedule | None, next_run_at: datetime | None) -> JobScheduleResponse:
    return JobScheduleResponse(
        enabled=schedule.enabled if schedule else False,
        cron_expression=schedule.cron_expression if schedule else None,
        next_run_at=next_run_at.isoformat() if next_run_at else None,
    )
