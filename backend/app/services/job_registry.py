import threading
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy.orm import Session

from app.services.exceptions import ConflictError, NotFoundError


class JobRunStatus(StrEnum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass(frozen=True)
class JobRunState:
    status: JobRunStatus = JobRunStatus.IDLE
    started_at: datetime | None = None
    finished_at: datetime | None = None
    result: dict[str, Any] | None = None
    error: str | None = None


@dataclass(frozen=True)
class JobDefinition:
    id: str
    run: Callable[[Callable[[], Session]], dict[str, Any]]


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


def trigger_run(job_id: str, session_factory: Callable[[], Session]) -> JobRunState:
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
    thread = threading.Thread(target=_run, args=(job_id, session_factory), daemon=True)
    thread.start()
    return snapshot


def _run(job_id: str, session_factory: Callable[[], Session]) -> None:
    lock = _locks[job_id]
    try:
        result = _definitions[job_id].run(session_factory)
        with lock:
            _states[job_id] = replace(
                _states[job_id], status=JobRunStatus.COMPLETED, result=result, finished_at=datetime.now(UTC)
            )
    except Exception as exc:  # noqa: BLE001 - any failure here must flip status to FAILED
        # rather than leaving the job stuck RUNNING forever with nothing observing this
        # thread.
        with lock:
            _states[job_id] = replace(
                _states[job_id], status=JobRunStatus.FAILED, error=str(exc), finished_at=datetime.now(UTC)
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
