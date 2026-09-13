import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.repositories import event_repository
from app.services.igdb_client import IGDBClient, IGDBCredentialsError
from app.services.job_registry import JobDefinition

JOB_EVENTS_SYNC = "events_sync"


def run(
    session_factory: Callable[[], Session],
    report_progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    db = session_factory()
    try:
        return asyncio.run(_sync(db, report_progress or (lambda current, total: None)))
    finally:
        db.close()


async def _sync(db: Session, report_progress: Callable[[int, int], None]) -> dict[str, Any]:
    """Fetches every currently-upcoming IGDB event in one call (EVENT_FIELDS already expands
    logo/networks/videos/games inline, unlike itad_jobs.py's per-item title lookups) then
    upserts each — per-item isolated so one bad payload can't abort the whole run — then
    prunes anything previously synced that has since ended."""
    settings = get_settings()
    if not settings.igdb_client_id or not settings.igdb_client_secret:
        raise IGDBCredentialsError("IGDB isn't configured yet — set IGDB_CLIENT_ID/IGDB_CLIENT_SECRET in .env.")

    client = IGDBClient()
    try:
        events = await client.get_upcoming_events()

        succeeded = 0
        failures: list[dict[str, Any]] = []
        for index, payload in enumerate(events):
            if index > 0:
                await asyncio.sleep(0.1)
            try:
                event_repository.upsert_from_igdb_payload(db, payload)
                db.commit()
                succeeded += 1
            except Exception as exc:  # noqa: BLE001 - one bad payload must not abort the batch
                db.rollback()
                failures.append(
                    {"igdbId": payload.get("id"), "name": payload.get("name"), "error": str(exc)}
                )
            report_progress(index + 1, len(events))

        pruned = event_repository.prune_ended(db)
        db.commit()

        return {
            "total": len(events),
            "succeeded": succeeded,
            "failed": len(failures),
            "failures": failures,
            "pruned": pruned,
        }
    finally:
        await client.aclose()


DEFINITION_EVENTS_SYNC = JobDefinition(id=JOB_EVENTS_SYNC, run=run)
