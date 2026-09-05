import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.system import User
from app.repositories import game_repository, steam_repository, steam_wishlist_repository
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


async def _match_to_igdb(db: Session, igdb_client: IGDBClient, steam_app_id: int) -> int | None:
    """Resolves a Steam AppID to a local Game id via IGDB's external_games mapping, importing
    the game (and its hierarchical DLC/expansion/pack children) if it isn't already in VGT.
    Shared by the owned-games and wishlist loops below — same matching sequence either way."""
    igdb_id = await igdb_client.get_igdb_id_for_steam_appid(steam_app_id)
    if igdb_id is None:
        return None

    game = game_repository.get_game_by_igdb_id(db, igdb_id)
    if game is None:
        game_with_status = await game_service.import_game_from_igdb(db, igdb_client, igdb_id)
        game = game_with_status.game
    return game.id


async def _import(db: Session) -> dict[str, Any]:
    """Fetches + caches + IGDB-matches the user's Steam library and wishlist — nothing more.
    This job never writes to LibraryItem/GameProgress, for tracked or untracked games alike;
    applying Steam's data to VGT is always a separate, explicit, user-confirmed action (see
    steam_service.sync_entries / steam_wishlist_service.sync_entries), triggered from the
    Insights → Steam Sync page."""
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
                    game_id = await _match_to_igdb(db, igdb_client, steam_game.app_id)
                    if game_id is not None:
                        steam_repository.set_game_id(db, entry, game_id)
                        db.commit()

                succeeded += 1
            except Exception as exc:  # noqa: BLE001 - one bad match/game must not abort the batch
                db.rollback()
                failures.append({"gameId": steam_game.app_id, "gameName": steam_game.name, "error": str(exc)})

        result: dict[str, Any] = {
            "total": len(owned_games),
            "succeeded": succeeded,
            "failed": len(failures),
            "failures": failures,
        }

        # A separate try/except around the whole phase — a wishlist-side problem (e.g. a
        # transient network error) must never roll back or hide the owned-games results
        # already committed above.
        try:
            result["wishlist"] = await _import_wishlist(db, steam_client, igdb_client, user.steam_id_64)
        except Exception as exc:  # noqa: BLE001 - see comment above
            result["wishlist"] = {"total": 0, "succeeded": 0, "failed": 0, "failures": [], "error": str(exc)}

        return result
    finally:
        await steam_client.aclose()
        await igdb_client.aclose()


async def _import_wishlist(
    db: Session, steam_client: SteamClient, igdb_client: IGDBClient, steam_id_64: str
) -> dict[str, Any]:
    wishlist_items = await steam_client.get_wishlist(steam_id_64)

    succeeded = 0
    failures: list[dict[str, Any]] = []
    for index, item in enumerate(wishlist_items):
        if index > 0:
            await asyncio.sleep(_PACE_DELAY_SECONDS)
        try:
            existing = steam_wishlist_repository.get_entry(db, item.app_id)
            # GetWishlist never gives a name (see SteamClient.get_wishlist) — keep whatever
            # name a prior match/custom-add already resolved rather than clobbering it with
            # the placeholder on every re-run.
            steam_name = existing.steam_name if existing else f"Steam App {item.app_id}"
            entry = steam_wishlist_repository.upsert_entry(db, item.app_id, steam_name, item.added_at)
            db.commit()

            if entry.game_id is None and not entry.dismissed:
                game_id = await _match_to_igdb(db, igdb_client, item.app_id)
                if game_id is not None:
                    steam_wishlist_repository.set_game_id(db, entry, game_id)
                    db.commit()

            succeeded += 1
        except Exception as exc:  # noqa: BLE001 - one bad match/game must not abort the batch
            db.rollback()
            failures.append({"gameId": item.app_id, "error": str(exc)})

    return {
        "total": len(wishlist_items),
        "succeeded": succeeded,
        "failed": len(failures),
        "failures": failures,
    }


DEFINITION_STEAM_IMPORT = JobDefinition(id=JOB_STEAM_IMPORT, run=run)
