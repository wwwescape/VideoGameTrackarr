from sqlalchemy.orm import Session

from app.models.events import Event
from app.repositories import event_repository
from app.services.exceptions import NotFoundError
from app.services.igdb_client import IGDBClient


def list_upcoming_events(db: Session) -> list[Event]:
    return event_repository.list_upcoming(db)


def get_event_by_slug(db: Session, slug: str) -> Event:
    event = event_repository.get_by_slug(db, slug)
    if event is None:
        raise NotFoundError(f"Event {slug} not found")
    return event


async def resync_event(db: Session, igdb_client: IGDBClient, event_id: int) -> Event:
    event = event_repository.get_by_id(db, event_id)
    if event is None:
        raise NotFoundError(f"Event {event_id} not found")

    payload = await igdb_client.get_event_by_igdb_id(event.igdb_id)
    if payload is None:
        raise NotFoundError(f"Event {event_id} no longer exists on IGDB")

    updated = event_repository.upsert_from_igdb_payload(db, payload)
    db.commit()
    return updated
