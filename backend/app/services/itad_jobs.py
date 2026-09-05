import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.repositories import itad_repository
from app.services.itad_client import ItadClient
from app.services.job_registry import JobDefinition

JOB_ITAD_REFRESH = "itad_refresh"

# Same reasoning as steam_jobs.py's _PACE_DELAY_SECONDS: ItadClient doesn't self-throttle
# across many sequential calls. Only the per-game title-lookup step is inherently
# per-item (no batch lookup endpoint) — price/historical-low fetch is batched below, one
# or two calls total rather than one per game.
_PACE_DELAY_SECONDS = 0.5


class ItadNotConfiguredError(Exception):
    """Raised when ITAD_API_KEY isn't set yet."""


def run(
    session_factory: Callable[[], Session],
    report_progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    db = session_factory()
    try:
        return asyncio.run(_refresh(db, report_progress or (lambda current, total: None)))
    finally:
        db.close()


async def _refresh(db: Session, report_progress: Callable[[int, int], None]) -> dict[str, Any]:
    """Fetches + caches ITAD price data for every wishlisted game — matches by title if not
    already matched, then batch-fetches current price + historical low for everything
    matched. Purely informational (never writes to anything the user typed, only the
    read-only ItadPriceCache), so unlike the Steam jobs there's no "explicit confirm before
    applying" concern here — this can run fully automatically."""
    settings = get_settings()
    if not settings.itad_api_key:
        raise ItadNotConfiguredError(
            "ITAD isn't configured yet — set ITAD_API_KEY in .env and restart VideoGameTrackarr."
        )

    client = ItadClient(api_key=settings.itad_api_key)
    try:
        games = itad_repository.list_distinct_wishlisted_games(db)

        succeeded = 0
        failures: list[dict[str, Any]] = []
        for index, game in enumerate(games):
            if index > 0:
                await asyncio.sleep(_PACE_DELAY_SECONDS)
            try:
                cache = itad_repository.get_or_create_cache(db, game.id)
                if cache.itad_game_id is None and not cache.ignored:
                    itad_id = await client.lookup_game_id(game.name)
                    itad_repository.set_itad_id(db, cache, itad_id)
                db.commit()
                succeeded += 1
            except Exception as exc:  # noqa: BLE001 - one bad title lookup must not abort the batch
                db.rollback()
                failures.append({"gameId": game.id, "gameName": game.name, "error": str(exc)})
            report_progress(index + 1, len(games))

        # Batched price + historical-low fetch for everything matched this run — a real
        # efficiency difference from the per-game IGDB calls Steam's job needs, since ITAD's
        # prices/historylow endpoints both accept an array of ids in one request. A failure
        # here fails the whole job (not per-item isolated, since it genuinely is one
        # request) — whatever matching already committed above stays saved either way.
        matched: dict[str, int] = {}
        for game in games:
            cache = itad_repository.get_cache(db, game.id)
            if cache and cache.itad_game_id:
                matched[cache.itad_game_id] = game.id

        if matched:
            itad_ids = list(matched.keys())
            prices = await client.get_prices(itad_ids, settings.itad_country)
            historical = await client.get_historical_low(itad_ids, settings.itad_country)
            for itad_id, game_id in matched.items():
                cache = itad_repository.get_cache(db, game_id)
                if cache:
                    itad_repository.update_price_data(db, cache, prices.get(itad_id), historical.get(itad_id))
            db.commit()

        return {
            "total": len(games),
            "succeeded": succeeded,
            "failed": len(failures),
            "failures": failures,
        }
    finally:
        await client.aclose()


DEFINITION_ITAD_REFRESH = JobDefinition(id=JOB_ITAD_REFRESH, run=run)
