import threading
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy.orm import Session

from app.schemas.backup import BackupPayload, BackupRestoreResult
from app.services import backup_service
from app.services.exceptions import ConflictError


class RestoreJobStatus(StrEnum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass(frozen=True)
class RestoreJobState:
    status: RestoreJobStatus = RestoreJobStatus.IDLE
    started_at: datetime | None = None
    finished_at: datetime | None = None
    result: BackupRestoreResult | None = None
    error: str | None = None


# Process-global, in-memory, like app/core/limiter.py's `limiter` — deliberately not
# per-request state. It exists specifically so a page refresh/navigation/tab close-reopen
# still sees a restore in progress; it does NOT survive the server process itself
# restarting, which is an accepted gap (restore doesn't trigger a restart, so this only
# matters for the rare case of the container dying mid-restore).
_lock = threading.Lock()
_state = RestoreJobState()


def get_state() -> RestoreJobState:
    with _lock:
        return _state


def start_restore(payload: BackupPayload, session_factory: Callable[[], Session]) -> RestoreJobState:
    global _state
    with _lock:
        if _state.status == RestoreJobStatus.RUNNING:
            raise ConflictError("A restore is already in progress.")
        _state = RestoreJobState(status=RestoreJobStatus.RUNNING, started_at=datetime.now(UTC))
        snapshot = _state

    # A real OS thread (not FastAPI's BackgroundTasks) is what actually lets the HTTP
    # response return to the client before the restore finishes — BackgroundTasks run as
    # part of the same ASGI call the response belongs to.
    thread = threading.Thread(target=_run_restore, args=(payload, session_factory), daemon=True)
    thread.start()
    return snapshot


def _run_restore(payload: BackupPayload, session_factory: Callable[[], Session]) -> None:
    global _state
    session: Session | None = None
    try:
        session = session_factory()
        result = backup_service.restore_backup(session, payload)
        with _lock:
            _state = replace(_state, status=RestoreJobStatus.COMPLETED, result=result, finished_at=datetime.now(UTC))
    except Exception as exc:  # noqa: BLE001 - any failure here (including session_factory
        # itself raising) must flip status to FAILED rather than leaving the job stuck
        # RUNNING forever with nothing observing this thread.
        if session is not None:
            session.rollback()
        with _lock:
            _state = replace(_state, status=RestoreJobStatus.FAILED, error=str(exc), finished_at=datetime.now(UTC))
    finally:
        if session is not None:
            session.close()


def acknowledge() -> None:
    """Clears a COMPLETED or FAILED job back to IDLE — lets the frontend dismiss a failed
    restore's blocking overlay instead of it staying up forever. A no-op while RUNNING."""
    global _state
    with _lock:
        if _state.status in (RestoreJobStatus.COMPLETED, RestoreJobStatus.FAILED):
            _state = RestoreJobState()


def reset_for_tests() -> None:
    global _state
    with _lock:
        _state = RestoreJobState()
