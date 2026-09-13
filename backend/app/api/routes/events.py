from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_igdb_client
from app.schemas.event import (
    EventDetailResponse,
    EventSummaryResponse,
    event_detail_from_orm,
    event_summary_from_orm,
)
from app.services import event_service
from app.services.igdb_client import IGDBClient

router = APIRouter(prefix="/api/events", tags=["events"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[EventSummaryResponse])
def list_events(db: Session = Depends(get_db)) -> list[EventSummaryResponse]:
    events = event_service.list_upcoming_events(db)
    return [event_summary_from_orm(event) for event in events]


@router.get("/{slug}", response_model=EventDetailResponse)
def get_event(slug: str, db: Session = Depends(get_db)) -> EventDetailResponse:
    event = event_service.get_event_by_slug(db, slug)
    return event_detail_from_orm(event)


@router.post("/{event_id}/resync", response_model=EventDetailResponse)
async def resync_event(
    event_id: int,
    db: Session = Depends(get_db),
    igdb_client: IGDBClient = Depends(get_igdb_client),
) -> EventDetailResponse:
    event = await event_service.resync_event(db, igdb_client, event_id)
    return event_detail_from_orm(event)
