import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from app.services import job_registry, nintendo_titledb
from app.services.exceptions import ConflictError
from app.services.job_registry import JobDefinition

JOB_NINTENDO_TITLEDB = "nintendo_titledb"


def run(
    session_factory: Callable[[], Session],
    report_progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    """Re-downloads the Nintendo title database NX Remote Launcher connectors resolve title
    IDs with (a few minutes; it changes as new games come out, so weekly is plenty)."""
    return {"titles": asyncio.run(nintendo_titledb.refresh_index())}


DEFINITION_NINTENDO_TITLEDB = JobDefinition(id=JOB_NINTENDO_TITLEDB, run=run)


def fetch_index_if_missing(session_factory: Callable[[], Session]) -> None:
    """The built-in Nintendo Switch connector needs the title list before its first sync;
    the weekly job would otherwise only fetch it on Monday."""
    if nintendo_titledb.load_index():
        return
    try:
        job_registry.trigger_run(JOB_NINTENDO_TITLEDB, session_factory)
    except ConflictError:
        pass
