import logging
from collections.abc import Callable
from datetime import datetime

from apscheduler.jobstores.base import JobLookupError
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.repositories import job_schedule_repository
from app.services import job_registry
from app.services.exceptions import ConflictError

logger = logging.getLogger(__name__)

# BackgroundScheduler (thread-based/sync), not AsyncIOScheduler — a fire hands off to a
# plain OS thread via job_registry.trigger_run, same as every other job trigger, rather than
# running inside uvicorn's own event loop. Matches this app's single-process deployment.
_scheduler = BackgroundScheduler()


def start(db: Session, session_factory: Callable[[], Session]) -> None:
    for schedule in job_schedule_repository.list_all(db):
        if schedule.enabled and schedule.cron_expression:
            _add_job(schedule.job_id, schedule.cron_expression, session_factory)
    if not _scheduler.running:
        _scheduler.start()


def shutdown() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)


def reset_for_tests() -> None:
    _scheduler.remove_all_jobs()


def _add_job(job_id: str, cron_expression: str, session_factory: Callable[[], Session]) -> None:
    _scheduler.add_job(
        func=_fire,
        trigger=CronTrigger.from_crontab(cron_expression),
        id=job_id,
        args=[job_id, session_factory],
        replace_existing=True,
        # Lets a fire scheduled right around a restart still happen instead of being
        # silently skipped, without coalescing a large backlog if the app was down a while.
        misfire_grace_time=60,
    )


def _fire(job_id: str, session_factory: Callable[[], Session]) -> None:
    try:
        job_registry.trigger_run(job_id, session_factory)
    except ConflictError:
        # A scheduled tick landing while "Run now" (or a still-running previous tick) is in
        # flight should skip quietly, not crash the scheduler thread.
        logger.info("Skipped scheduled run of job %s: already running", job_id)


def reschedule(job_id: str, enabled: bool, cron_expression: str | None, session_factory: Callable[[], Session]) -> None:
    """Applies a schedule change to the live scheduler immediately, so an edit via the API
    takes effect without an app restart."""
    if enabled and cron_expression:
        _add_job(job_id, cron_expression, session_factory)
        return

    try:
        _scheduler.remove_job(job_id)
    except JobLookupError:
        pass


def get_next_run_time(job_id: str) -> datetime | None:
    job = _scheduler.get_job(job_id)
    if job is None:
        return None
    # A job added while the scheduler isn't running yet is only "tentatively" scheduled
    # (see APScheduler's own log message for this) — next_run_time isn't computed until the
    # scheduler actually starts processing it, and the attribute is unset (not None) until
    # then, since Job uses __slots__.
    return getattr(job, "next_run_time", None)
