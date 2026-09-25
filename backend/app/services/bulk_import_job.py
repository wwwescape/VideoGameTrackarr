import asyncio
import threading
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy.orm import Session

from app.services import game_service, library_service, tag_service
from app.services.exceptions import ConflictError
from app.services.igdb_client import IGDBClient


class BulkImportJobStatus(StrEnum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass(frozen=True)
class BulkImportProgress:
    current: int
    total: int


@dataclass(frozen=True)
class BulkImportJobState:
    status: BulkImportJobStatus = BulkImportJobStatus.IDLE
    started_at: datetime | None = None
    finished_at: datetime | None = None
    progress: BulkImportProgress | None = None
    result: dict[str, Any] | None = None
    error: str | None = None


# Process-global, in-memory, single slot — same shape and same reasoning as
# app/services/restore_job.py (which this module deliberately mirrors): exists so a page
# refresh/navigation/tab close-reopen still sees a run in progress, but does NOT survive the
# server process itself restarting. Bulk-import is a one-off action with real per-run
# parameters (which igdb_ids, which tags, which library defaults) rather than a fixed
# recurring operation, which is exactly why this follows restore_job's precedent instead of
# the Settings -> Jobs registry (job_registry.py) — confirmed via direct read that its
# JobDefinition.run/trigger_run take no per-invocation arguments at all, only a session
# factory, so it has no way to carry a specific request's igdb_ids/tags/library defaults
# through a run.
_lock = threading.Lock()
_state = BulkImportJobState()


def get_state() -> BulkImportJobState:
    with _lock:
        return _state


def start_bulk_import(
    igdb_ids: list[int],
    tag_ids: list[int],
    library_defaults: dict[str, Any] | None,
    session_factory: Callable[[], Session],
) -> BulkImportJobState:
    global _state
    with _lock:
        if _state.status == BulkImportJobStatus.RUNNING:
            raise ConflictError("A bulk import is already in progress.")
        _state = BulkImportJobState(status=BulkImportJobStatus.RUNNING, started_at=datetime.now(UTC))
        snapshot = _state

    # A real OS thread, not FastAPI's BackgroundTasks — same reasoning as restore_job: that
    # runs as part of the same ASGI call the response belongs to, which would block the 202
    # response from returning until every game finished importing.
    thread = threading.Thread(
        target=_run, args=(igdb_ids, tag_ids, library_defaults, session_factory), daemon=True
    )
    thread.start()
    return snapshot


def _set_progress(current: int, total: int) -> None:
    global _state
    with _lock:
        if _state.status == BulkImportJobStatus.RUNNING:
            _state = replace(_state, progress=BulkImportProgress(current=current, total=total))


def _run(
    igdb_ids: list[int],
    tag_ids: list[int],
    library_defaults: dict[str, Any] | None,
    session_factory: Callable[[], Session],
) -> None:
    global _state
    session: Session | None = None
    try:
        session = session_factory()
        result = asyncio.run(_import_all(session, igdb_ids, tag_ids, library_defaults))
        with _lock:
            _state = replace(
                _state,
                status=BulkImportJobStatus.COMPLETED,
                result=result,
                finished_at=datetime.now(UTC),
                progress=None,
            )
    except Exception as exc:  # noqa: BLE001 - any failure here (including session_factory
        # itself raising) must flip status to FAILED rather than leaving the job stuck
        # RUNNING forever with nothing observing this thread.
        if session is not None:
            session.rollback()
        with _lock:
            _state = replace(
                _state, status=BulkImportJobStatus.FAILED, error=str(exc), finished_at=datetime.now(UTC), progress=None
            )
    finally:
        if session is not None:
            session.close()


async def _import_all(
    db: Session, igdb_ids: list[int], tag_ids: list[int], library_defaults: dict[str, Any] | None
) -> dict[str, Any]:
    # A fresh, short-lived IGDBClient rather than app.state.igdb_client — same reasoning as
    # resync_jobs.py: that client's httpx.AsyncClient is bound to uvicorn's own event loop,
    # and this job runs on a plain threading.Thread with no event loop of its own until
    # asyncio.run() creates one here.
    client = IGDBClient()
    succeeded = 0
    failures: list[dict[str, Any]] = []
    try:
        for index, igdb_id in enumerate(igdb_ids):
            try:
                game = await game_service.import_game_from_igdb(db, client, igdb_id)
                # Tag/library-entry attachment happen after the game's own commit
                # (import_game_from_igdb commits internally) — a failure here still leaves
                # the game itself imported, just without these extras, same "one bad step
                # doesn't undo an earlier good one" tradeoff resync_jobs.py already accepts.
                # The failure message says so explicitly rather than implying nothing happened.
                try:
                    for tag_id in tag_ids:
                        tag_service.attach_tag(db, game.game.id, tag_id)
                    if library_defaults is not None:
                        library_service.add_library_item(db, game.game.id, **library_defaults)
                    succeeded += 1
                except Exception as exc:  # noqa: BLE001 - isolate a tag/library-entry failure
                    # to this one game rather than aborting the whole batch.
                    db.rollback()
                    failures.append(
                        {
                            # camelCase keys, not resync_jobs.py's snake_case ("game_id"/
                            # "game_name") — that mismatch against the frontend's camelCase
                            # types is a known, still-unfixed bug in that older job (see
                            # TODOS.md); steam_jobs.py already established camelCase as the
                            # right shape for new jobs, and this follows that precedent.
                            "igdbId": igdb_id,
                            "gameName": game.game.name,
                            "error": f"Game was imported, but failed to apply tags/library entry: {exc}",
                        }
                    )
            except Exception as exc:  # noqa: BLE001 - one bad game (e.g. removed from IGDB,
                # already-addon category) must not abort the whole batch.
                db.rollback()
                failures.append({"igdbId": igdb_id, "gameName": None, "error": str(exc)})
            _set_progress(index + 1, len(igdb_ids))
    finally:
        await client.aclose()

    return {
        "total": len(igdb_ids),
        "succeeded": succeeded,
        "failed": len(failures),
        "failures": failures,
    }


def acknowledge() -> None:
    """Clears a COMPLETED or FAILED job back to IDLE. A no-op while RUNNING."""
    global _state
    with _lock:
        if _state.status in (BulkImportJobStatus.COMPLETED, BulkImportJobStatus.FAILED):
            _state = BulkImportJobState()


def reset_for_tests() -> None:
    global _state
    with _lock:
        _state = BulkImportJobState()
