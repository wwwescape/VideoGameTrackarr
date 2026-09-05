import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.repositories import platprices_repository
from app.services.job_registry import JobDefinition
from app.services.platprices_client import PlatPricesClient

JOB_PLATPRICES_REFRESH = "platprices_refresh"

# Same reasoning as itad_jobs.py's _PACE_DELAY_SECONDS: PlatPricesClient doesn't self-throttle
# across many sequential calls. Only the per-game title-search step is inherently per-item (no
# batch search endpoint) — price + historical-low refresh is one single batched /games/batch
# call for everything matched, unlike itad_jobs.py which needs two batched calls.
_PACE_DELAY_SECONDS = 0.5


class PlatPricesNotConfiguredError(Exception):
    """Raised when PLATPRICES_API_KEY isn't set yet."""


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
    """Fetches + caches PlatPrices data for every PlatPrices-eligible wishlisted game (PS4/PS5
    + digital — see platprices_repository.list_distinct_wishlisted_games, deliberately
    pre-filtered unlike itad_jobs.py's equivalent, since PlatPrices' free tier is only 1,000
    requests/month and matching spend must stay proportional to actual PS wishlist size).
    Purely informational, same as itad_jobs.py — no confirm-before-applying concern, since
    this only ever writes to the read-only PlatPricesCache."""
    settings = get_settings()
    if not settings.platprices_api_key:
        raise PlatPricesNotConfiguredError(
            "PlatPrices isn't configured yet — set PLATPRICES_API_KEY in .env and restart VideoGameTrackarr."
        )

    client = PlatPricesClient(api_key=settings.platprices_api_key)
    try:
        games = platprices_repository.list_distinct_wishlisted_games(db)

        succeeded = 0
        failures: list[dict[str, Any]] = []
        for index, game in enumerate(games):
            if index > 0:
                await asyncio.sleep(_PACE_DELAY_SECONDS)
            try:
                cache = platprices_repository.get_or_create_cache(db, game.id)
                if cache.ppid is None and not cache.ignored:
                    ppid = await client.search_game(game.name, settings.platprices_region)
                    platprices_repository.set_ppid(db, cache, ppid)
                db.commit()
                succeeded += 1
            except Exception as exc:  # noqa: BLE001 - one bad title lookup must not abort the batch
                db.rollback()
                failures.append({"gameId": game.id, "gameName": game.name, "error": str(exc)})
            report_progress(index + 1, len(games))

        # One batched call for everything matched this run — PlatPrices' /games/batch response
        # already carries both current price and historical-low data on the same game object,
        # so (unlike ITAD) there's no second endpoint to call here. A failure here fails the
        # whole job (not per-item isolated, since it genuinely is one request) — whatever
        # matching already committed above stays saved either way.
        matched: dict[str, int] = {}
        for game in games:
            cache = platprices_repository.get_cache(db, game.id)
            if cache and cache.ppid:
                matched[cache.ppid] = game.id

        if matched:
            price_data = await client.get_price_data(list(matched.keys()), settings.platprices_region)
            for ppid, game_id in matched.items():
                cache = platprices_repository.get_cache(db, game_id)
                if cache:
                    data = price_data.get(ppid)
                    platprices_repository.update_price_data(
                        db, cache, data.current_deal if data else None, data.historical_low if data else None
                    )
            db.commit()

        return {
            "total": len(games),
            "succeeded": succeeded,
            "failed": len(failures),
            "failures": failures,
        }
    finally:
        await client.aclose()


DEFINITION_PLATPRICES_REFRESH = JobDefinition(id=JOB_PLATPRICES_REFRESH, run=run)
