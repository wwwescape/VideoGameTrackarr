from collections.abc import Callable

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_igdb_client, get_session_factory
from app.schemas.igdb_import import (
    IgdbImportCountResponse,
    IgdbImportEntryResponse,
    IgdbImportGameIdsRequest,
    IgdbImportIgnoreRequest,
    igdb_import_entry_from_row,
)
from app.services import igdb_import_jobs, igdb_import_service, job_registry
from app.services.igdb_client import IGDBClient

# Settings → IGDB Import: custom games and their IGDB name matches (found by the Find matches
# job), linked one by one or in bulk.
router = APIRouter(prefix="/api/igdb-import", tags=["igdb-import"], dependencies=[Depends(get_current_user)])


@router.get("/entries", response_model=list[IgdbImportEntryResponse])
def list_entries(db: Session = Depends(get_db)) -> list[IgdbImportEntryResponse]:
    return [igdb_import_entry_from_row(row) for row in igdb_import_service.list_rows(db)]


@router.post("/link", response_model=IgdbImportCountResponse, status_code=202)
def link_selected(
    body: IgdbImportGameIdsRequest,
    db: Session = Depends(get_db),
    session_factory: Callable[[], Session] = Depends(get_session_factory),
) -> IgdbImportCountResponse:
    """Link selected: queues the games with a match and starts the Link job (409 while it's
    already running)."""
    count = igdb_import_service.queue_for_linking(db, body.game_ids)
    if count:
        job_registry.trigger_run(igdb_import_jobs.JOB_IGDB_LINK, session_factory)
    return IgdbImportCountResponse(count=count)


@router.post("/ignore", response_model=IgdbImportCountResponse)
def set_ignored(body: IgdbImportIgnoreRequest, db: Session = Depends(get_db)) -> IgdbImportCountResponse:
    return IgdbImportCountResponse(count=igdb_import_service.set_ignored(db, body.game_ids, body.ignored))


@router.post("/{game_id}/link", response_model=IgdbImportCountResponse)
async def link_one(
    game_id: int, db: Session = Depends(get_db), igdb_client: IGDBClient = Depends(get_igdb_client)
) -> IgdbImportCountResponse:
    await igdb_import_service.link_entry(db, igdb_client, game_id)
    return IgdbImportCountResponse(count=1)
