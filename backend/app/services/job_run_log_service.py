"""Per-run logs for job_registry jobs (Settings -> Jobs -> Logs).

A run's row is inserted when it starts and finalized when it ends, so history survives a
restart that job_registry's in-memory state doesn't. While a run is in progress its lines
live in a RunCollector (served live to the log viewer) and are written to the row once, at
the end. Lines come from three places: the registry's own start/progress/finish lines,
anything the job's thread logs through Python logging (app.* at INFO+, any library at
WARNING+), and one line per item in the result's "failures" list.
"""

import logging
import threading
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.jobs import JobRunLog
from app.repositories import job_run_log_repository

logger = logging.getLogger(__name__)

# Newest runs kept per job; older ones are pruned after every run.
MAX_LOGS_PER_JOB = 25
# A full resync of a big library could otherwise log thousands of lines per run.
MAX_LINES_PER_RUN = 2000

TRIGGER_MANUAL = "manual"
TRIGGER_SCHEDULED = "scheduled"
TRIGGER_CATCH_UP = "catch_up"

INTERRUPTED_ERROR = "Interrupted: the app stopped while this run was in progress."


@dataclass
class RunCollector:
    job_id: str
    log_id: int | None
    lines: list[dict[str, str]] = field(default_factory=list)
    dropped: int = 0
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def add(self, level: str, message: str) -> None:
        with self._lock:
            if len(self.lines) >= MAX_LINES_PER_RUN - 1:
                # Keeps the last slot for the "N more lines dropped" marker written on finish.
                self.dropped += 1
                return
            self.lines.append({"t": datetime.now(UTC).isoformat(), "level": level, "msg": message})

    def snapshot(self) -> list[dict[str, str]]:
        with self._lock:
            lines = list(self.lines)
            if self.dropped:
                lines.append(
                    {
                        "t": datetime.now(UTC).isoformat(),
                        "level": "WARNING",
                        "msg": f"{self.dropped} more line(s) not kept (limit {MAX_LINES_PER_RUN} per run)",
                    }
                )
            return lines


# The collector for the run executing on the current thread (each run has its own thread,
# see job_registry.trigger_run), read by _CaptureHandler to route log records to it.
_current = threading.local()
# In-progress runs by log id, so the viewer can show a running log's lines live.
_active: dict[int, RunCollector] = {}
_active_lock = threading.Lock()


def current() -> RunCollector | None:
    return getattr(_current, "collector", None)


class _CaptureHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        collector = current()
        if collector is None:
            return
        if not (record.name.startswith("app.") or record.levelno >= logging.WARNING):
            return
        try:
            message = record.getMessage()
        except Exception:  # noqa: BLE001 - a bad format string must never break the job
            message = str(record.msg)
        collector.add(record.levelname, message)


_handler = _CaptureHandler(level=logging.INFO)


def _ensure_handler_installed() -> None:
    # Checked per run rather than once at import: app/core/logging.configure_logging replaces
    # the root logger's handler list wholesale.
    root = logging.getLogger()
    if _handler not in root.handlers:
        root.addHandler(_handler)


def begin(job_id: str, trigger: str, started_at: datetime, session_factory: Callable[[], Session]) -> RunCollector:
    """Inserts the run's row and makes its collector current for this thread. Never raises —
    a logging failure must not stop the job itself from running."""
    log_id: int | None = None
    try:
        db = session_factory()
        try:
            row = job_run_log_repository.create(db, job_id, trigger, started_at)
            db.commit()
            log_id = row.id if isinstance(row.id, int) else None
        finally:
            db.close()
    except Exception:  # noqa: BLE001
        logger.exception("Couldn't create a run log for job %s", job_id)

    collector = RunCollector(job_id=job_id, log_id=log_id)
    _current.collector = collector
    if log_id is not None:
        with _active_lock:
            _active[log_id] = collector
    _ensure_handler_installed()
    collector.add("INFO", f"Started ({_trigger_label(trigger)})")
    return collector


def finish(
    collector: RunCollector,
    status: str,
    finished_at: datetime,
    started_at: datetime,
    result: dict[str, Any] | None,
    error: str | None,
    session_factory: Callable[[], Session],
) -> None:
    _current.collector = None
    for line in _failure_lines(result):
        collector.add("WARNING", line)
    duration = _format_duration((finished_at - started_at).total_seconds())
    if status == "completed":
        summary = _result_summary(result)
        collector.add("INFO", f"Completed in {duration}" + (f": {summary}" if summary else ""))
    else:
        collector.add("ERROR", f"Failed after {duration}: {error}")

    if collector.log_id is not None:
        with _active_lock:
            _active.pop(collector.log_id, None)
        try:
            db = session_factory()
            try:
                row = db.get(JobRunLog, collector.log_id)
                if row is not None:
                    row.status = status
                    row.finished_at = finished_at
                    row.result = result
                    row.error = error
                    row.lines = collector.snapshot()
                job_run_log_repository.prune(db, collector.job_id, MAX_LOGS_PER_JOB)
                db.commit()
            finally:
                db.close()
        except Exception:  # noqa: BLE001
            logger.exception("Couldn't save the run log for job %s", collector.job_id)


def live_lines(log_id: int) -> list[dict[str, str]] | None:
    with _active_lock:
        collector = _active.get(log_id)
    return collector.snapshot() if collector else None


def is_active(log_id: int) -> bool:
    with _active_lock:
        return log_id in _active


def list_logs(db: Session, job_id: str) -> list[JobRunLog]:
    return job_run_log_repository.list_for_job(db, job_id)


def get_log(db: Session, job_id: str, log_id: int) -> JobRunLog | None:
    return job_run_log_repository.get(db, job_id, log_id)


def latest(db: Session, job_id: str) -> JobRunLog | None:
    return job_run_log_repository.latest(db, job_id)


def latest_started_at(db: Session, job_id: str) -> datetime | None:
    return job_run_log_repository.latest_started_at(db, job_id)


def clear_logs(db: Session, job_id: str) -> int:
    deleted = job_run_log_repository.clear(db, job_id)
    db.commit()
    return deleted


def close_interrupted(db: Session) -> None:
    """Called once at startup: any row still "running" belongs to a run the previous process
    died during (in-memory run state never survives a restart)."""
    closed = job_run_log_repository.close_interrupted(db, INTERRUPTED_ERROR)
    db.commit()
    if closed:
        logger.info("Marked %d interrupted job run(s) as failed", closed)


def progress_line(collector: RunCollector, current: int, total: int, last_quarter: int) -> int:
    """Logs the item count on the first report, then each 25% step. Returns the last quarter
    logged, which the caller passes back on its next report."""
    if total <= 0:
        return last_quarter
    if last_quarter < 0:
        collector.add("INFO", f"Working through {total} item(s)")
        last_quarter = 0
    quarter = (current * 4) // total
    if quarter > last_quarter and quarter < 4:
        collector.add("INFO", f"{current}/{total} done ({quarter * 25}%)")
        last_quarter = quarter
    return last_quarter


def _trigger_label(trigger: str) -> str:
    return {
        TRIGGER_MANUAL: "run manually",
        TRIGGER_SCHEDULED: "on schedule",
        TRIGGER_CATCH_UP: "catching up on a missed scheduled run",
    }.get(trigger, trigger)


def _failure_lines(result: dict[str, Any] | None) -> list[str]:
    if not isinstance(result, dict):
        return []
    lines = []
    for failure in result.get("failures") or []:
        if not isinstance(failure, dict):
            continue
        name = next(
            (failure[key] for key in ("gameName", "game_name", "name", "title") if failure.get(key)),
            None,
        ) or next(
            (f"#{failure[key]}" for key in ("gameId", "game_id", "igdbId", "id") if failure.get(key) is not None),
            "Item",
        )
        lines.append(f"{name}: {failure.get('error', 'failed')}")
    return lines


def _result_summary(result: dict[str, Any] | None) -> str:
    if not isinstance(result, dict):
        return ""
    parts = []
    for key, value in result.items():
        if isinstance(value, bool) or not isinstance(value, int | float):
            continue
        parts.append(f"{value} {key}")
    return ", ".join(parts)


def _format_duration(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.1f}s"
    minutes, secs = divmod(int(seconds), 60)
    if minutes < 60:
        return f"{minutes}m {secs}s"
    hours, minutes = divmod(minutes, 60)
    return f"{hours}h {minutes}m"
