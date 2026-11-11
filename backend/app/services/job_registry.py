import threading
import traceback
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy.orm import Session

from app.services import job_run_log_service
from app.services.exceptions import ConflictError, NotFoundError


class JobRunStatus(StrEnum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass(frozen=True)
class JobProgress:
    current: int
    total: int


@dataclass(frozen=True)
class JobRunState:
    status: JobRunStatus = JobRunStatus.IDLE
    started_at: datetime | None = None
    finished_at: datetime | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    progress: JobProgress | None = None


@dataclass(frozen=True)
class JobDefinition:
    id: str
    # The second argument lets a job report {current, total} back as it works through a
    # list, so the Jobs UI can show a live progress bar instead of just an indefinite
    # "running" chip — see set_progress below. Optional on the job's own side (every job
    # function defaults it to a no-op) so existing direct/unit-test callers that only pass
    # session_factory keep working unchanged.
    run: Callable[[Callable[[], Session], Callable[[int, int], None]], dict[str, Any]]
    # False for a job only started from its own page (IGDB Import's bulk Link works through
    # the games queued there), which Settings -> Jobs doesn't list or offer to schedule.
    listed: bool = True


# Process-global, in-memory — generalizes app/services/restore_job.py's single global slot
# into a per-job-id map, keyed by JobDefinition.id. Same accepted tradeoff as that module:
# this exists so a page refresh/navigation still sees a run in progress, but does NOT
# survive the server process itself restarting.
_definitions: dict[str, JobDefinition] = {}
_locks: dict[str, threading.Lock] = {}
_states: dict[str, JobRunState] = {}


def register(definition: JobDefinition) -> None:
    if definition.id in _definitions:
        raise ValueError(f"Job {definition.id!r} is already registered")
    _definitions[definition.id] = definition
    _locks[definition.id] = threading.Lock()
    _states[definition.id] = JobRunState()


def list_jobs() -> list[JobDefinition]:
    return list(_definitions.values())


def _lock_for(job_id: str) -> threading.Lock:
    lock = _locks.get(job_id)
    if lock is None:
        raise NotFoundError(f"Job {job_id} not found")
    return lock


def get_state(job_id: str) -> JobRunState:
    lock = _lock_for(job_id)
    with lock:
        return _states[job_id]


def trigger_run(
    job_id: str,
    session_factory: Callable[[], Session],
    trigger: str = job_run_log_service.TRIGGER_MANUAL,
) -> JobRunState:
    """Starts a run on its own thread. `trigger` (manual/scheduled/catch_up) is recorded in
    the run's log."""
    if job_id not in _definitions:
        raise NotFoundError(f"Job {job_id} not found")

    lock = _locks[job_id]
    with lock:
        if _states[job_id].status == JobRunStatus.RUNNING:
            raise ConflictError(f"Job {job_id} is already running")
        _states[job_id] = JobRunState(status=JobRunStatus.RUNNING, started_at=datetime.now(UTC))
        snapshot = _states[job_id]

    # A real OS thread (not FastAPI's BackgroundTasks) — same reasoning as
    # restore_job.start_restore: BackgroundTasks runs as part of the same ASGI call the
    # response belongs to, which would block the response from returning until the job
    # finishes.
    thread = threading.Thread(target=_run, args=(job_id, session_factory, trigger), daemon=True)
    thread.start()
    return snapshot


def set_progress(job_id: str, current: int, total: int) -> None:
    lock = _lock_for(job_id)
    with lock:
        # Guards against a stray report arriving after the job already finished (e.g. one
        # queued right as a failure short-circuits the run) from resurrecting progress on a
        # state that's no longer RUNNING.
        if _states[job_id].status == JobRunStatus.RUNNING:
            _states[job_id] = replace(_states[job_id], progress=JobProgress(current=current, total=total))


def _run(
    job_id: str,
    session_factory: Callable[[], Session],
    trigger: str = job_run_log_service.TRIGGER_MANUAL,
) -> None:
    lock = _locks[job_id]
    started_at = _states[job_id].started_at or datetime.now(UTC)
    collector = job_run_log_service.begin(job_id, trigger, started_at, session_factory)
    last_quarter = -1

    def reporter(current: int, total: int) -> None:
        nonlocal last_quarter
        set_progress(job_id, current, total)
        last_quarter = job_run_log_service.progress_line(collector, current, total, last_quarter)

    try:
        result = _definitions[job_id].run(session_factory, reporter)
    except Exception as exc:  # noqa: BLE001 - any failure here must flip status to FAILED
        # rather than leaving the job stuck RUNNING forever with nothing observing this
        # thread.
        finished_at = datetime.now(UTC)
        collector.add("ERROR", traceback.format_exc().rstrip())
        # Log saved before the state flips, so a client that sees FAILED also sees its log.
        job_run_log_service.finish(
            collector, JobRunStatus.FAILED.value, finished_at, started_at, None, str(exc), session_factory
        )
        with lock:
            _states[job_id] = replace(
                _states[job_id],
                status=JobRunStatus.FAILED,
                error=str(exc),
                finished_at=finished_at,
                progress=None,
            )
        return

    finished_at = datetime.now(UTC)
    job_run_log_service.finish(
        collector, JobRunStatus.COMPLETED.value, finished_at, started_at, result, None, session_factory
    )
    with lock:
        _states[job_id] = replace(
            _states[job_id],
            status=JobRunStatus.COMPLETED,
            result=result,
            finished_at=finished_at,
            progress=None,
        )


def acknowledge(job_id: str) -> None:
    """Clears a COMPLETED or FAILED job back to IDLE. A no-op while RUNNING."""
    lock = _lock_for(job_id)
    with lock:
        if _states[job_id].status in (JobRunStatus.COMPLETED, JobRunStatus.FAILED):
            _states[job_id] = JobRunState()


def reset_for_tests() -> None:
    """Clears only run-state, not registrations — registrations are process-lifetime, like
    app.include_router(...) calls in main.py, so wiping them per-test would break every
    "list jobs" test."""
    for job_id in list(_states.keys()):
        _states[job_id] = JobRunState()
