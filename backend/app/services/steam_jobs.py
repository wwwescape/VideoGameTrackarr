import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.system import User
from app.repositories import game_repository, steam_repository
from app.services import game_service
from app.services.igdb_client import IGDBClient
from app.services.job_registry import JobDefinition
from app.services.steam_client import SteamClient

JOB_STEAM_IMPORT = "steam_import"

# Same reasoning as resync_jobs.py's _PACE_DELAY_SECONDS: neither SteamClient nor
# IGDBClient self-throttles across many sequential calls, and this loop can make up to two
# IGDB requests per unmatched Steam game (external_games lookup, then a full game import).
_PACE_DELAY_SECONDS = 0.5


class SteamNotConfiguredError(Exception):
    """Raised when either STEAM_API_KEY or the user's SteamID64 isn't set yet."""


class SteamProfilePrivateError(Exception):
    """Raised when Steam's response has no "games" key at all — a private/friends-only
    profile, not "this account owns 0 games" (see SteamClient.get_owned_games)."""


def run(session_factory: Callable[[], Session]) -> dict[str, Any]:
    db = session_factory()
    try:
        return asyncio.run(_import(db))
    finally:
        db.close()


async def _import(db: Session) -> dict[str, Any]:
    """Fetches + caches + IGDB-matches the user's Steam library — nothing more. This job
    never writes to LibraryItem/GameProgress, for tracked or untracked games alike; applying
    Steam's data to VGT is always a separate, explicit, user-confirmed action (see
    steam_service.sync_entries), triggered from the Insights → Steam Sync page."""
    settings = get_settings()
    user = db.scalars(select(User)).first()
    if not settings.steam_api_key or not (user and user.steam_id_64):
        raise SteamNotConfiguredError(
            "Steam isn't configured yet — set STEAM_API_KEY in .env and add a SteamID64 in "
            "Settings → Integrations."
        )

    # Fresh, short-lived clients rather than any shared instance — same reasoning as
    # resync_jobs.py: this job runs on a plain threading.Thread with no event loop of its
    # own until asyncio.run() creates one here.
    steam_client = SteamClient(api_key=settings.steam_api_key)
    igdb_client = IGDBClient()
    try:
        owned_games = await steam_client.get_owned_games(user.steam_id_64)
        if owned_games is None:
            raise SteamProfilePrivateError(
                "Steam profile is private or has no game details visible — check its privacy "
                "settings (Game details must be Public)."
            )

        succeeded = 0
        failures: list[dict[str, Any]] = []
        for index, steam_game in enumerate(owned_games):
            if index > 0:
                await asyncio.sleep(_PACE_DELAY_SECONDS)
            try:
                entry = steam_repository.upsert_entry(
                    db, steam_game.app_id, steam_game.name, steam_game.playtime_minutes, steam_game.last_played_at
                )
                db.commit()

                if entry.game_id is None and not entry.dismissed:
                    igdb_id = await igdb_client.get_igdb_id_for_steam_appid(steam_game.app_id)
                    if igdb_id is not None:
                        game = game_repository.get_game_by_igdb_id(db, igdb_id)
                        if game is None:
                            game_with_status = await game_service.import_game_from_igdb(db, igdb_client, igdb_id)
                            game = game_with_status.game
                        steam_repository.set_game_id(db, entry, game.id)
                        db.commit()

                succeeded += 1
            except Exception as exc:  # noqa: BLE001 - one bad match/game must not abort the batch
                db.rollback()
                failures.append({"gameId": steam_game.app_id, "gameName": steam_game.name, "error": str(exc)})

        return {
            "total": len(owned_games),
            "succeeded": succeeded,
            "failed": len(failures),
            "failures": failures,
        }
    finally:
        await steam_client.aclose()
        await igdb_client.aclose()


DEFINITION_STEAM_IMPORT = JobDefinition(id=JOB_STEAM_IMPORT, run=run)
