"""The "Fetch alternative names" job: fills game_alternative_names for every IGDB-linked game
in a handful of requests, so short-name search ("gta 6", "botw") works for games imported
before alternative names were stored, without a full resync (~2 IGDB calls per game).

Writes only alternative names. A full or Games resync stores them too, through the import
path (game_service._sync_catalog_richness)."""

import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from app.core.search_keys import alternative_names_from_igdb
from app.models.catalog import Game
from app.repositories import game_media_repository, game_repository
from app.services.igdb_client import ALTERNATIVE_NAMES_BATCH_SIZE, IGDBClient
from app.services.job_registry import JobDefinition

JOB_ALTERNATIVE_NAMES = "alternative_names"

# Between batches, like resync_jobs' per-game pacing, so a large library stays well under
# IGDB's 4 requests/second.
_PACE_DELAY_SECONDS = 0.5


def run(
    session_factory: Callable[[], Session],
    report_progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    db = session_factory()
    try:
        return asyncio.run(_fetch_all(db, report_progress or (lambda current, total: None)))
    finally:
        db.close()


async def _fetch_all(db: Session, report_progress: Callable[[int, int], None]) -> dict[str, Any]:
    # (id, name) for the failure list; the IGDB id comes per batch below.
    games = game_repository.list_igdb_linked_games(db)
    # A fresh client for this thread's own event loop — see resync_jobs._resync_all.
    client = IGDBClient()
    succeeded = 0
    failures: list[dict[str, Any]] = []
    done = 0
    try:
        for start in range(0, len(games), ALTERNATIVE_NAMES_BATCH_SIZE):
            if start > 0:
                await asyncio.sleep(_PACE_DELAY_SECONDS)
            batch = games[start : start + ALTERNATIVE_NAMES_BATCH_SIZE]
            rows = {game.id: game for game in db.query(Game).filter(Game.id.in_([game_id for game_id, _ in batch]))}
            batch_succeeded = 0
            batch_failures: list[dict[str, Any]] = []
            try:
                names_by_igdb_id = await client.get_alternative_names_by_ids(
                    [rows[game_id].igdb_id for game_id, _ in batch if game_id in rows]
                )
                for game_id, game_name in batch:
                    game = rows.get(game_id)
                    if game is None or game.igdb_id not in names_by_igdb_id:
                        # Deleted meanwhile, or no longer on IGDB.
                        batch_failures.append(
                            {"game_id": game_id, "game_name": game_name, "error": "Not found on IGDB"}
                        )
                        continue
                    game_media_repository.sync_alternative_names(
                        db, game.id, alternative_names_from_igdb(game.name, names_by_igdb_id[game.igdb_id])
                    )
                    batch_succeeded += 1
                db.commit()
            except Exception as exc:  # noqa: BLE001 - one failed batch must not abort the rest
                db.rollback()
                batch_succeeded = 0
                batch_failures = [
                    {"game_id": game_id, "game_name": game_name, "error": str(exc)} for game_id, game_name in batch
                ]
            succeeded += batch_succeeded
            failures.extend(batch_failures)
            done += len(batch)
            report_progress(done, len(games))
    finally:
        await client.aclose()

    return {"total": len(games), "succeeded": succeeded, "failed": len(failures), "failures": failures}


DEFINITION_ALTERNATIVE_NAMES = JobDefinition(id=JOB_ALTERNATIVE_NAMES, run=run)
