from collections.abc import Callable

from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.models.jobs import JobSchedule
from app.repositories import job_schedule_repository
from app.services import job_scheduler


def get_schedule(db: Session, job_id: str) -> JobSchedule | None:
    return job_schedule_repository.get_by_job_id(db, job_id)


def update_schedule(
    db: Session,
    job_id: str,
    enabled: bool,
    cron_expression: str | None,
    session_factory: Callable[[], Session],
) -> JobSchedule:
    if enabled:
        if not cron_expression:
            raise ValueError("cronExpression is required when enabled")
        # Raises ValueError for a malformed cron string — surfaced by the route as 400.
        CronTrigger.from_crontab(cron_expression)

    schedule = job_schedule_repository.upsert(db, job_id, enabled, cron_expression)
    db.commit()
    job_scheduler.reschedule(job_id, enabled, cron_expression, session_factory)
    return schedule
