import asyncio
import threading
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy.orm import Session

from app.repositories import game_repository
from app.services import game_service
from app.services.exceptions import ConflictError
from app.services.game_service import CatalogSyncScope
from app.services.igdb_client import IGDBClient

# resync_game/import_game_from_igdb makes 2 IGDB HTTP calls per game and nothing in
# IGDBClient self-throttles across many sequential calls — same pacing constant and
# reasoning as app/services/resync_jobs.py's own copy.
_PACE_DELAY_SECONDS = 0.5


class CatalogResyncKind(StrEnum):
    COLLECTION = "collection"
    FRANCHISE = "franchise"


class CatalogResyncStatus(StrEnum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass(frozen=True)
class CatalogResyncProgress:
    current: int
    total: int


@dataclass(frozen=True)
class CatalogResyncResult:
    total_candidates: int
    added: int
    skipped_existing: int
    failed: int
    failures: list[dict[str, Any]]


@dataclass(frozen=True)
class CatalogResyncState:
    status: CatalogResyncStatus = CatalogResyncStatus.IDLE
    kind: CatalogResyncKind | None = None
    ref_igdb_id: int | None = None
    # ref_slug/ref_name exist purely for the frontend's "is the currently-running job mine"
    # check and its progress display — the worker itself only ever needs ref_igdb_id.
    ref_slug: str | None = None
    ref_name: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    progress: CatalogResyncProgress | None = None
    result: CatalogResyncResult | None = None
    error: str | None = None


# Process-global, in-memory, single-slot — same shape and tradeoff as
# app/services/restore_job.py (a page refresh/navigation still sees a run in progress, but
# this does NOT survive the server process restarting). A fixed-id job_registry.py entry
# doesn't fit here since collection/franchise ids are dynamic and unbounded, and this
# shouldn't appear in the Settings > Jobs list alongside the scheduled/bulk jobs.
_lock = threading.Lock()
_state = CatalogResyncState()


def get_state() -> CatalogResyncState:
    with _lock:
        return _state


def start_resync(
    kind: CatalogResyncKind,
    ref_igdb_id: int,
    ref_slug: str | None,
    ref_name: str,
    session_factory: Callable[[], Session],
) -> CatalogResyncState:
    global _state
    with _lock:
        if _state.status == CatalogResyncStatus.RUNNING:
            raise ConflictError("A catalog resync is already in progress.")
        _state = CatalogResyncState(
            status=CatalogResyncStatus.RUNNING,
            kind=kind,
            ref_igdb_id=ref_igdb_id,
            ref_slug=ref_slug,
            ref_name=ref_name,
            started_at=datetime.now(UTC),
        )
        snapshot = _state

    thread = threading.Thread(target=_run_resync, args=(kind, ref_igdb_id, session_factory), daemon=True)
    thread.start()
    return snapshot


def _set_progress(current: int, total: int) -> None:
    global _state
    with _lock:
        if _state.status == CatalogResyncStatus.RUNNING:
            _state = replace(_state, progress=CatalogResyncProgress(current=current, total=total))


def _run_resync(kind: CatalogResyncKind, ref_igdb_id: int, session_factory: Callable[[], Session]) -> None:
    global _state
    db: Session | None = None
    try:
        db = session_factory()
        result = asyncio.run(_resync_missing_games(db, kind, ref_igdb_id))
        with _lock:
            _state = replace(_state, status=CatalogResyncStatus.COMPLETED, result=result, finished_at=datetime.now(UTC))
    except Exception as exc:  # noqa: BLE001 - any failure here (including the IGDB
        # collection/franchise fetch itself) must flip status to FAILED rather than leaving
        # the job stuck RUNNING forever with nothing observing this thread.
        if db is not None:
            db.rollback()
        with _lock:
            _state = replace(_state, status=CatalogResyncStatus.FAILED, error=str(exc), finished_at=datetime.now(UTC))
    finally:
        if db is not None:
            db.close()


async def _resync_missing_games(db: Session, kind: CatalogResyncKind, ref_igdb_id: int) -> CatalogResyncResult:
    # A fresh, short-lived IGDBClient rather than reusing app.state.igdb_client — see
    # app/services/resync_jobs.py for why (its httpx.AsyncClient is bound to uvicorn's own
    # event loop; this job runs on a plain threading.Thread with no event loop of its own
    # until asyncio.run() creates one here).
    client = IGDBClient()
    try:
        member_ids = (
            await client.get_collection_member_game_ids(ref_igdb_id)
            if kind == CatalogResyncKind.COLLECTION
            else await client.get_franchise_member_game_ids(ref_igdb_id)
        )
        if member_ids is None:
            member_ids = []

        missing_ids = [igdb_id for igdb_id in member_ids if game_repository.get_game_by_igdb_id(db, igdb_id) is None]

        added = 0
        failures: list[dict[str, Any]] = []
        for index, igdb_id in enumerate(missing_ids):
            if index > 0:
                await asyncio.sleep(_PACE_DELAY_SECONDS)
            try:
                await game_service.import_game_from_igdb(
                    db, client, igdb_id, scope=CatalogSyncScope.ALL, auto_discovered=True
                )
                added += 1
            except Exception as exc:  # noqa: BLE001 - one bad game must not abort the batch,
                # same isolation as app/services/resync_jobs.py's _resync_all.
                db.rollback()
                failures.append({"igdb_id": igdb_id, "error": str(exc)})
            _set_progress(index + 1, len(missing_ids))

        return CatalogResyncResult(
            total_candidates=len(member_ids),
            added=added,
            skipped_existing=len(member_ids) - len(missing_ids),
            failed=len(failures),
            failures=failures,
        )
    finally:
        await client.aclose()


def acknowledge() -> None:
    """Clears a COMPLETED or FAILED job back to IDLE. A no-op while RUNNING."""
    global _state
    with _lock:
        if _state.status in (CatalogResyncStatus.COMPLETED, CatalogResyncStatus.FAILED):
            _state = CatalogResyncState()


def reset_for_tests() -> None:
    global _state
    with _lock:
        _state = CatalogResyncState()
