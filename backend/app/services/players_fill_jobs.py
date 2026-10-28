import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from app.repositories import connector_repository, game_repository
from app.services import nintendo_titledb
from app.services.job_registry import JobDefinition
from app.services.pcgamingwiki_client import PCGamingWikiClient
from app.services.steam_store_client import SteamStoreClient

JOB_PLAYERS_FILL = "players_fill"

SOURCE_NINTENDO = "nintendo"
SOURCE_PCGAMINGWIKI = "pcgamingwiki"
SOURCE_STEAM = "steam"

# One lookup a second: PCGamingWiki is a volunteer-run wiki, and Steam's store API has
# informal rate limits (see SteamStoreClient). The job only asks about the games IGDB has no
# count for, so a run is a few minutes, not hours.
_PACE_DELAY_SECONDS = 1.0


def run(
    session_factory: Callable[[], Session],
    report_progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    db = session_factory()
    try:
        return asyncio.run(_fill(db, report_progress or (lambda current, total: None)))
    finally:
        db.close()


async def _fill(db: Session, report_progress: Callable[[int, int], None]) -> dict[str, Any]:
    """Looks up a local player count for every library game IGDB has none for: the Nintendo
    title database for a game an NX Remote Launcher connector reported (no network call),
    PCGamingWiki for a PC game (it counts players), then the Steam store's categories for a
    game matched to Steam (they only say whether it's played on one screen, so "2 or more").
    What's found goes in local_players_fallback, never local_players, so the next IGDB
    resync doesn't erase it; a game found nowhere keeps no fallback rather than a stale one."""
    games = game_repository.list_games_missing_local_players(db)
    switch_titles = connector_repository.nintendo_title_ids_by_game(db)
    wiki = PCGamingWikiClient()
    store = SteamStoreClient()
    found = 0
    failures: list[dict[str, Any]] = []
    try:
        for index, game in enumerate(games):
            try:
                local_players, source = None, None
                titles = [nintendo_titledb.get_title(title_id) for title_id in switch_titles.get(game.id, [])]
                counts = [title.players for title in titles if title and title.players]
                if counts:
                    local_players, source = max(counts), SOURCE_NINTENDO
                elif game.on_pc or game.steam_app_id is not None:
                    if index > 0:
                        await asyncio.sleep(_PACE_DELAY_SECONDS)
                    local_players = await wiki.get_local_players(game.name, game.steam_app_id)
                    source = SOURCE_PCGAMINGWIKI
                if local_players is None and game.steam_app_id is not None:
                    await asyncio.sleep(_PACE_DELAY_SECONDS)
                    local_players = await store.get_local_players(game.steam_app_id)
                    source = SOURCE_STEAM
                game_repository.set_local_players_fallback(
                    db, game.id, local_players, source if local_players is not None else None
                )
                db.commit()
                found += local_players is not None
            except Exception as exc:  # noqa: BLE001 - one unreachable page must not abort the batch
                db.rollback()
                failures.append({"game_id": game.id, "game_name": game.name, "error": str(exc)})
            report_progress(index + 1, len(games))
    finally:
        await wiki.aclose()
        await store.aclose()

    return {
        "total": len(games),
        "succeeded": len(games) - len(failures),
        "found": found,
        "failed": len(failures),
        "failures": failures,
    }


DEFINITION_PLAYERS_FILL = JobDefinition(id=JOB_PLAYERS_FILL, run=run)
