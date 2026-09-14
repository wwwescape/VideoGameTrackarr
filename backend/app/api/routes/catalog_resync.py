from collections.abc import Callable

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_session_factory
from app.repositories import collection_repository, franchise_repository
from app.schemas.catalog_resync import (
    CatalogResyncFailureResponse,
    CatalogResyncProgressResponse,
    CatalogResyncResultResponse,
    CatalogResyncStatusResponse,
)
from app.services import catalog_resync_job
from app.services.catalog_resync_job import CatalogResyncKind
from app.services.exceptions import NotFoundError

router = APIRouter(tags=["catalog-resync"], dependencies=[Depends(get_current_user)])


def _to_response(state: catalog_resync_job.CatalogResyncState) -> CatalogResyncStatusResponse:
    return CatalogResyncStatusResponse(
        status=state.status.value,
        kind=state.kind.value if state.kind else None,
        ref_slug=state.ref_slug,
        ref_name=state.ref_name,
        started_at=state.started_at.isoformat() if state.started_at else None,
        finished_at=state.finished_at.isoformat() if state.finished_at else None,
        progress=CatalogResyncProgressResponse(current=state.progress.current, total=state.progress.total)
        if state.progress
        else None,
        result=CatalogResyncResultResponse(
            total_candidates=state.result.total_candidates,
            added=state.result.added,
            skipped_existing=state.result.skipped_existing,
            failed=state.result.failed,
            failures=[
                CatalogResyncFailureResponse(igdb_id=failure["igdb_id"], error=failure["error"])
                for failure in state.result.failures
            ],
        )
        if state.result
        else None,
        error=state.error,
    )


@router.post(
    "/api/collections/{slug}/resync", response_model=CatalogResyncStatusResponse, status_code=status.HTTP_202_ACCEPTED
)
def resync_collection(
    slug: str,
    db: Session = Depends(get_db),
    session_factory: Callable[[], Session] = Depends(get_session_factory),
) -> CatalogResyncStatusResponse:
    """Kicks off discovery of IGDB-known games in this Collection that aren't in VGT at all
    yet, as a background job — see app/services/catalog_resync_job.py. Callers poll
    GET /api/catalog-resync/status for progress; a second resync while one is already
    running raises ConflictError, surfaced as 409 by the app-wide handler in app/main.py."""
    collection = collection_repository.get_by_slug(db, slug)
    if collection is None:
        raise NotFoundError(f"Collection {slug} not found")
    if collection.igdb_id is None:
        raise NotFoundError(f"Collection {slug} has no IGDB id to resync from")

    state = catalog_resync_job.start_resync(
        CatalogResyncKind.COLLECTION, collection.igdb_id, collection.slug, collection.name, session_factory
    )
    return _to_response(state)


@router.post(
    "/api/franchises/{slug}/resync", response_model=CatalogResyncStatusResponse, status_code=status.HTTP_202_ACCEPTED
)
def resync_franchise(
    slug: str,
    db: Session = Depends(get_db),
    session_factory: Callable[[], Session] = Depends(get_session_factory),
) -> CatalogResyncStatusResponse:
    franchise = franchise_repository.get_by_slug(db, slug)
    if franchise is None:
        raise NotFoundError(f"Franchise {slug} not found")
    if franchise.igdb_id is None:
        raise NotFoundError(f"Franchise {slug} has no IGDB id to resync from")

    state = catalog_resync_job.start_resync(
        CatalogResyncKind.FRANCHISE, franchise.igdb_id, franchise.slug, franchise.name, session_factory
    )
    return _to_response(state)


@router.get("/api/catalog-resync/status", response_model=CatalogResyncStatusResponse)
def catalog_resync_status() -> CatalogResyncStatusResponse:
    return _to_response(catalog_resync_job.get_state())


@router.post("/api/catalog-resync/status/acknowledge", status_code=status.HTTP_204_NO_CONTENT)
def acknowledge_catalog_resync_status() -> None:
    catalog_resync_job.acknowledge()
