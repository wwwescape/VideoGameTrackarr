"""IGDB Import's two jobs: Find matches (searches IGDB for every custom game by name and saves
what it finds — listed in Settings → Jobs, so it can be scheduled) and Link (links the games
picked with Link selected, one by one — only started from the IGDB Import page)."""

import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from app.services import igdb_import_service
from app.services.igdb_client import IGDBClient
from app.services.job_registry import JobDefinition

JOB_IGDB_MATCH = "igdb_match"
JOB_IGDB_LINK = "igdb_link"

# Same reasoning as resync_jobs.py's _PACE_DELAY_SECONDS: IGDBClient doesn't throttle itself
# across many sequential calls (IGDB allows 4 requests a second).
_PACE_DELAY_SECONDS = 0.5


def _run_async(session_factory: Callable[[], Session], work, report_progress) -> dict[str, Any]:
    db = session_factory()
    try:
        return asyncio.run(work(db, report_progress or (lambda current, total: None)))
    finally:
        db.close()


def run_match(
    session_factory: Callable[[], Session], report_progress: Callable[[int, int], None] | None = None
) -> dict[str, Any]:
    return _run_async(session_factory, _match, report_progress)


def run_link(
    session_factory: Callable[[], Session], report_progress: Callable[[int, int], None] | None = None
) -> dict[str, Any]:
    return _run_async(session_factory, _link, report_progress)


async def _match(db: Session, report_progress: Callable[[int, int], None]) -> dict[str, Any]:
    """Searches IGDB by name for every custom game not ignored and records its match (see
    igdb_import_service.pick_match). Addons are searched among IGDB's addons, games among
    its games."""
    games = [
        game
        for game in igdb_import_service.list_custom_games(db)
        if not ((entry := igdb_import_service.get_entry(db, game.id)) is not None and entry.dismissed)
    ]
    # A fresh, short-lived client: this runs on a plain thread with no event loop of its own
    # until asyncio.run() makes one (same as resync_jobs.py).
    igdb_client = IGDBClient()
    succeeded = 0
    failures: list[dict[str, Any]] = []
    try:
        for index, game in enumerate(games):
            if index > 0:
                await asyncio.sleep(_PACE_DELAY_SECONDS)
            try:
                scope = "addon" if game.category in igdb_import_service.LINKABLE_ADDON_CATEGORIES else "game"
                candidates = await igdb_client.search_games(game.name, category_scope=scope)
                igdb_import_service.record_match(db, game, candidates)
                db.commit()
                succeeded += 1
            except Exception as exc:  # noqa: BLE001 - one failed search must not stop the rest
                db.rollback()
                failures.append({"gameId": game.id, "gameName": game.name, "error": str(exc)})
            report_progress(index + 1, len(games))
    finally:
        await igdb_client.aclose()
    return {"total": len(games), "succeeded": succeeded, "failed": len(failures), "failures": failures}


async def _link(db: Session, report_progress: Callable[[int, int], None]) -> dict[str, Any]:
    """Links every game queued with Link selected to its match (igdb_import_service.link_entry),
    one by one; a game that can't be linked is reported and left on the page."""
    game_ids = igdb_import_service.list_queued_game_ids(db)
    igdb_client = IGDBClient()
    succeeded = 0
    failures: list[dict[str, Any]] = []
    try:
        for index, game_id in enumerate(game_ids):
            if index > 0:
                await asyncio.sleep(_PACE_DELAY_SECONDS)
            name = igdb_import_service.game_name(db, game_id)
            try:
                await igdb_import_service.link_entry(db, igdb_client, game_id)
                succeeded += 1
            except Exception as exc:  # noqa: BLE001 - one failed link must not stop the rest
                db.rollback()
                igdb_import_service.unqueue(db, game_id)
                failures.append({"gameId": game_id, "gameName": name, "error": str(exc)})
            report_progress(index + 1, len(game_ids))
    finally:
        await igdb_client.aclose()
    return {"total": len(game_ids), "succeeded": succeeded, "failed": len(failures), "failures": failures}


DEFINITION_IGDB_MATCH = JobDefinition(id=JOB_IGDB_MATCH, run=run_match)
DEFINITION_IGDB_LINK = JobDefinition(id=JOB_IGDB_LINK, run=run_link, listed=False)
