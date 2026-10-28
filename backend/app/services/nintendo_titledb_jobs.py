import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from app.services import nintendo_titledb
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
