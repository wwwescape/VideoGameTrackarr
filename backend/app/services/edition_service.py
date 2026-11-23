"""Editions of the same game: a base game and the editions IGDB records as versions of it
(version_parent), e.g. Forza Horizon 5 and its Deluxe and Premium editions. The add-on pickers
offer add-ons (and packs) from these only.

Imports and resyncs store version_parent. Games imported before VGT stored it are filled in
once, in batches of 500, the first time a picker needs them (ensure_version_parents)."""

import logging
import time

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.catalog import Game
from app.services.igdb_client import IGDBClient

logger = logging.getLogger(__name__)

# After IGDB fails (not set up, offline), don't try again on every picker open.
_RETRY_AFTER_SECONDS = 10 * 60
_last_failure: float | None = None


async def ensure_version_parents(db: Session, igdb_client: IGDBClient) -> None:
    """Fills in version_parent for IGDB games that don't have it checked yet. Best effort: the
    pickers still work without it, offering only the game's own editions VGT already knows."""
    global _last_failure
    if _last_failure is not None and time.monotonic() - _last_failure < _RETRY_AFTER_SECONDS:
        return
    pending = list(
        db.scalars(select(Game.igdb_id).where(Game.igdb_id.is_not(None), Game.version_parent_checked.is_(False)))
    )
    if not pending:
        return
    try:
        parents = await igdb_client.get_version_parent_ids([int(igdb_id) for igdb_id in pending])
    except Exception:
        _last_failure = time.monotonic()
        logger.warning("Couldn't read editions from IGDB; will retry later", exc_info=True)
        return
    for igdb_id, parent_id in parents.items():
        db.execute(
            update(Game)
            .where(Game.igdb_id == igdb_id)
            .values(version_parent_igdb_id=parent_id, version_parent_checked=True)
        )
    db.commit()
    _last_failure = None
