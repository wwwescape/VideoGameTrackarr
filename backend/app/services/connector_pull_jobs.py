import asyncio
from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from app.models.connector import STORE_KINDS
from app.repositories import connector_repository
from app.services import connector_service
from app.services.igdb_client import IGDBClient
from app.services.job_registry import JobDefinition

JOB_CONNECTORS_PULL = "connectors_pull"


def run(
    session_factory: Callable[[], Session],
    report_progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    db = session_factory()
    try:
        return asyncio.run(_pull_all(db, session_factory, report_progress or (lambda current, total: None)))
    finally:
        db.close()


async def _pull_all(
    db: Session, session_factory: Callable[[], Session], report_progress: Callable[[int, int], None]
) -> dict[str, Any]:
    """Syncs every signed-in store connector (Epic, GOG) — one failing (a sign-in that
    expired, the store being down) doesn't stop the others, and shows on the Jobs page."""
    connectors = [c for c in connector_repository.list_connectors(db) if c.kind in STORE_KINDS and c.credentials]
    igdb_client = IGDBClient()
    succeeded = 0
    failures: list[dict[str, Any]] = []
    try:
        for index, connector in enumerate(connectors):
            try:
                await connector_service.pull(db, connector, igdb_client, session_factory)
                succeeded += 1
            except Exception as exc:  # noqa: BLE001 - one store failing must not stop the others
                db.rollback()
                failures.append({"connectorId": connector.id, "name": connector.name, "error": str(exc)})
            report_progress(index + 1, len(connectors))
    finally:
        await igdb_client.aclose()
    return {"total": len(connectors), "succeeded": succeeded, "failed": len(failures), "failures": failures}


DEFINITION_CONNECTORS_PULL = JobDefinition(id=JOB_CONNECTORS_PULL, run=run)
