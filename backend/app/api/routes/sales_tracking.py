from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.sales_tracking import (
    IgnoredSalesTitleResponse,
    SalesProvider,
    TrackedSalesItemResponse,
    tracked_sales_item_from_orm,
)
from app.services import itad_service, library_service, platprices_service

router = APIRouter(prefix="/api/sales-tracking", tags=["sales-tracking"], dependencies=[Depends(get_current_user)])

_SERVICE_BY_PROVIDER = {"itad": itad_service, "platprices": platprices_service}


@router.get("/ignored", response_model=list[IgnoredSalesTitleResponse])
def list_ignored_sales_titles(db: Session = Depends(get_db)) -> list[IgnoredSalesTitleResponse]:
    items = [
        (item, "itad")
        for item in itad_service.list_ignored_items(db)
    ] + [
        (item, "platprices")
        for item in platprices_service.list_ignored_items(db)
    ]
    responses = [
        IgnoredSalesTitleResponse(
            provider=provider,
            game_id=item.game.id,
            game_uuid=item.game.uuid,
            game_name=item.game.name,
            game_slug=item.game.slug,
            game_cover_url=item.game.cover_url,
            checked_at=item.checked_at,
        )
        for item, provider in items
    ]
    responses.sort(key=lambda entry: entry.game_name.lower())
    return responses


@router.post("/ignored/{provider}/{game_id}/retry", status_code=status.HTTP_204_NO_CONTENT)
def retry_ignored_sales_title(provider: SalesProvider, game_id: int, db: Session = Depends(get_db)) -> None:
    _SERVICE_BY_PROVIDER[provider].retry_ignored_item(db, game_id)


@router.post("/ignored/{provider}/{game_id}/remove", status_code=status.HTTP_204_NO_CONTENT)
def remove_ignored_sales_title(provider: SalesProvider, game_id: int, db: Session = Depends(get_db)) -> None:
    _SERVICE_BY_PROVIDER[provider].remove_ignored_item(db, game_id)


@router.get("/tracked", response_model=list[TrackedSalesItemResponse])
def list_tracked_sales_items(db: Session = Depends(get_db)) -> list[TrackedSalesItemResponse]:
    items = library_service.list_tracked_items(db)
    return [tracked_sales_item_from_orm(item) for item in items]


@router.post("/tracked/{library_item_id}/untrack", status_code=status.HTTP_204_NO_CONTENT)
def untrack_sales_item(library_item_id: int, db: Session = Depends(get_db)) -> None:
    library_service.update_library_item(db, library_item_id, track_for_sales=False)
