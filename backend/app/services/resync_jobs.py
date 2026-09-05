import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from app.repositories import game_repository
from app.services import game_service
from app.services.game_service import CatalogSyncScope
from app.services.igdb_client import IGDBClient
from app.services.job_registry import JobDefinition

JOB_ALL = "resync_all"
JOB_GAMES = "resync_games"
JOB_COLLECTIONS = "resync_collections"
JOB_SERIES = "resync_series"

# resync_game makes 2 IGDB HTTP calls per game (see game_service.import_game_from_igdb) and
# nothing in IGDBClient self-throttles across many sequential calls — this bounds a full
# resync to roughly 4 req/s instead of firing as fast as the event loop allows. Applies to
# every scope: IGDB always returns every field together in one query regardless of scope
# (see GAME_FIELDS in igdb_client.py), so a narrower job makes exactly as many network calls
# as the full one — narrowing only changes what gets written, not what gets fetched.
_PACE_DELAY_SECONDS = 0.5


def _make_run(
    scope: CatalogSyncScope,
) -> Callable[[Callable[[], Session], Callable[[int, int], None]], dict[str, Any]]:
    def run(
        session_factory: Callable[[], Session],
        report_progress: Callable[[int, int], None] | None = None,
    ) -> dict[str, Any]:
        db = session_factory()
        try:
            return asyncio.run(_resync_all(db, scope, report_progress or (lambda current, total: None)))
        finally:
            db.close()

    return run


async def _resync_all(
    db: Session, scope: CatalogSyncScope, report_progress: Callable[[int, int], None]
) -> dict[str, Any]:
    # Snapshotted up front so a failure record can still carry a human-readable name even
    # after a later db.rollback().
    games = game_repository.list_igdb_linked_games(db)

    # A fresh, short-lived IGDBClient rather than reusing app.state.igdb_client: that
    # client's httpx.AsyncClient is bound to uvicorn's own event loop (created in
    # app/main.py's lifespan), and this job runs on a plain threading.Thread with no event
    # loop of its own until asyncio.run() creates one here. One extra OAuth token fetch per
    # run is negligible next to the hundreds of per-game calls this job already makes.
    client = IGDBClient()
    succeeded = 0
    failures: list[dict[str, Any]] = []
    try:
        for index, (game_id, game_name) in enumerate(games):
            if index > 0:
                await asyncio.sleep(_PACE_DELAY_SECONDS)
            try:
                await game_service.resync_game(db, client, game_id, scope=scope)
                succeeded += 1
            except Exception as exc:  # noqa: BLE001 - one bad game (e.g. removed from IGDB)
                # must not abort the whole batch; resync_game/import_game_from_igdb don't
                # isolate failures themselves.
                db.rollback()
                failures.append({"game_id": game_id, "game_name": game_name, "error": str(exc)})
            report_progress(index + 1, len(games))
    finally:
        await client.aclose()

    return {
        "total": len(games),
        "succeeded": succeeded,
        "failed": len(failures),
        "failures": failures,
    }


DEFINITION_ALL = JobDefinition(id=JOB_ALL, run=_make_run(CatalogSyncScope.ALL))
DEFINITION_GAMES = JobDefinition(id=JOB_GAMES, run=_make_run(CatalogSyncScope.GAMES))
DEFINITION_COLLECTIONS = JobDefinition(id=JOB_COLLECTIONS, run=_make_run(CatalogSyncScope.COLLECTIONS))
DEFINITION_SERIES = JobDefinition(id=JOB_SERIES, run=_make_run(CatalogSyncScope.SERIES))
