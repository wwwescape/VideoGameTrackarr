import logging
from collections.abc import Callable
from datetime import datetime, timedelta, tzinfo
from zoneinfo import ZoneInfo

import tzlocal
from apscheduler.jobstores.base import JobLookupError
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.repositories import job_schedule_repository
from app.services import job_registry, job_run_log_service
from app.services.exceptions import ConflictError, NotFoundError

logger = logging.getLogger(__name__)

# Startup catch-up runs wait this long (so the app finishes starting first), then are spaced
# this far apart so several missed jobs don't all hit IGDB at the same moment.
_CATCH_UP_DELAY = timedelta(seconds=30)
_CATCH_UP_SPACING = timedelta(seconds=60)
_CATCH_UP_SUFFIX = ":catch_up"


def _resolve_timezone() -> tzinfo:
    """The zone cron expressions are read in: the TZ environment variable if set (e.g.
    TZ=Europe/Lisbon in .env for Docker, whose containers otherwise run in UTC), else the
    host's own zone. A bad TZ falls back to UTC instead of stopping the app from starting."""
    try:
        return tzlocal.get_localzone()
    except Exception:  # noqa: BLE001
        logger.warning("Couldn't resolve the timezone (check TZ); job schedules will use UTC")
        return ZoneInfo("UTC")


_timezone = _resolve_timezone()

# BackgroundScheduler (thread-based/sync), not AsyncIOScheduler — a fire hands off to a
# plain OS thread via job_registry.trigger_run, same as every other job trigger, rather than
# running inside uvicorn's own event loop. Matches this app's single-process deployment.
_scheduler = BackgroundScheduler(timezone=_timezone)


def timezone_name() -> str:
    return getattr(_timezone, "key", None) or str(_timezone)


def start(db: Session, session_factory: Callable[[], Session]) -> None:
    job_run_log_service.close_interrupted(db)
    now = datetime.now(_timezone)
    catch_up_index = 0
    for schedule in job_schedule_repository.list_all(db):
        if not (schedule.enabled and schedule.cron_expression):
            continue
        try:
            _add_job(schedule.job_id, schedule.cron_expression, session_factory)
        except ValueError:
            logger.warning("Ignoring invalid schedule %r for job %s", schedule.cron_expression, schedule.job_id)
            continue
        if _missed_a_run(db, schedule.job_id, schedule.cron_expression, schedule.updated_at, now):
            _add_catch_up(schedule.job_id, now + _CATCH_UP_DELAY + _CATCH_UP_SPACING * catch_up_index, session_factory)
            catch_up_index += 1
    if not _scheduler.running:
        _scheduler.start()


def shutdown() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)


def reset_for_tests() -> None:
    _scheduler.remove_all_jobs()


def _missed_a_run(
    db: Session, job_id: str, cron_expression: str, schedule_saved_at: datetime | None, now: datetime
) -> bool:
    """True when a scheduled fire fell between the job's last run (any trigger, from its run
    logs) — or, if it never ran, when the schedule was saved — and now: i.e. the app was down
    (or the machine asleep) when it was due. Only one catch-up per job, however many fires
    were missed."""
    since = job_run_log_service.latest_started_at(db, job_id) or schedule_saved_at
    if since is None:
        return False
    if since.tzinfo is None:  # SQLite's server_default timestamps are naive UTC
        since = since.replace(tzinfo=ZoneInfo("UTC"))
    # Converted first: CronTrigger matches its fields in whatever zone the start date is in.
    since = since.astimezone(_timezone)
    due = CronTrigger.from_crontab(cron_expression, timezone=_timezone).get_next_fire_time(None, since)
    return due is not None and due <= now


def _add_job(job_id: str, cron_expression: str, session_factory: Callable[[], Session]) -> None:
    _scheduler.add_job(
        func=_fire,
        trigger=CronTrigger.from_crontab(cron_expression, timezone=_timezone),
        id=job_id,
        args=[job_id, session_factory, job_run_log_service.TRIGGER_SCHEDULED],
        replace_existing=True,
        # No grace limit + coalesce: a fire that comes due while the process is paused (the
        # host asleep, a long GC) still runs once on resume instead of being silently
        # skipped, which a 60s grace used to do. Fires missed while the app was fully down
        # are handled by the catch-up check in start().
        misfire_grace_time=None,
        coalesce=True,
    )


def _add_catch_up(job_id: str, run_at: datetime, session_factory: Callable[[], Session]) -> None:
    logger.info("Job %s missed a scheduled run while the app was down; catching up at %s", job_id, run_at)
    _scheduler.add_job(
        func=_fire,
        trigger="date",
        run_date=run_at,
        id=job_id + _CATCH_UP_SUFFIX,
        args=[job_id, session_factory, job_run_log_service.TRIGGER_CATCH_UP],
        replace_existing=True,
        misfire_grace_time=None,
    )


def _fire(
    job_id: str, session_factory: Callable[[], Session], trigger: str = job_run_log_service.TRIGGER_SCHEDULED
) -> None:
    try:
        job_registry.trigger_run(job_id, session_factory, trigger)
    except ConflictError:
        # A scheduled tick landing while "Run now" (or a still-running previous tick) is in
        # flight should skip quietly, not crash the scheduler thread.
        logger.info("Skipped scheduled run of job %s: already running", job_id)
    except NotFoundError:
        logger.warning("Skipped scheduled run of unknown job %s", job_id)


def reschedule(job_id: str, enabled: bool, cron_expression: str | None, session_factory: Callable[[], Session]) -> None:
    """Applies a schedule change to the live scheduler immediately, so an edit via the API
    takes effect without an app restart."""
    if enabled and cron_expression:
        _add_job(job_id, cron_expression, session_factory)
        return

    for scheduled_id in (job_id, job_id + _CATCH_UP_SUFFIX):
        try:
            _scheduler.remove_job(scheduled_id)
        except JobLookupError:
            pass


def get_next_run_time(job_id: str) -> datetime | None:
    times = []
    for scheduled_id in (job_id, job_id + _CATCH_UP_SUFFIX):
        job = _scheduler.get_job(scheduled_id)
        # A job added while the scheduler isn't running yet is only "tentatively" scheduled
        # (see APScheduler's own log message for this) — next_run_time isn't computed until
        # the scheduler actually starts processing it, and the attribute is unset (not None)
        # until then, since Job uses __slots__.
        if job is not None and (next_run := getattr(job, "next_run_time", None)) is not None:
            times.append(next_run)
    return min(times) if times else None
