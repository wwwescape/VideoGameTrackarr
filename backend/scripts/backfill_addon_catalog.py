"""One-time backfill: resync every top-level game so its addons get (re-)fetched from IGDB
without the category filter that used to silently exclude real DLC/expansions/packs (see
get_addons_by_parent_igdb_id in app/services/igdb_client.py). This re-populates cover/genres/
companies/platforms/screenshots for addons that already existed locally with that data
missing, and picks up any addons that were never imported at all because of the filter.

Usage:
    python -m scripts.backfill_addon_catalog
"""

import asyncio

from sqlalchemy import select

from app.db.session import session_scope
from app.models.catalog import Game
from app.services import game_service
from app.services.igdb_client import IGDBClient

# Stay comfortably under IGDB's ~4 requests/second limit — each game costs roughly 3-4
# requests (game refetch, addon fetch, one cover batch each).
REQUEST_PACING_SECONDS = 0.4


async def main() -> None:
    igdb_client = IGDBClient()
    try:
        with session_scope() as db:
            game_ids = list(
                db.scalars(
                    select(Game.id).where(Game.parent_game_id.is_(None), Game.igdb_id.is_not(None)).order_by(Game.id)
                )
            )

        print(f"Resyncing {len(game_ids)} top-level games...")
        succeeded = 0
        failed: list[tuple[int, str]] = []
        for index, game_id in enumerate(game_ids, start=1):
            try:
                with session_scope() as db:
                    result = await game_service.resync_game(db, igdb_client, game_id)
                succeeded += 1
                print(f"[{index}/{len(game_ids)}] resynced {result.game.name!r}")
            except Exception as exc:
                failed.append((game_id, str(exc)))
                print(f"[{index}/{len(game_ids)}] FAILED game_id={game_id}: {exc}")
            await asyncio.sleep(REQUEST_PACING_SECONDS)

        print(f"\nDone. {succeeded} succeeded, {len(failed)} failed.")
        for game_id, error in failed:
            print(f"  game_id={game_id}: {error}")
    finally:
        await igdb_client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
