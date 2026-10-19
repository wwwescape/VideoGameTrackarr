from datetime import UTC, datetime

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.events import Event, EventGame, EventNetwork, EventVideo
from app.repositories import game_repository


def get_by_id(db: Session, event_id: int) -> Event | None:
    return db.get(Event, event_id)


def get_by_slug(db: Session, slug: str) -> Event | None:
    stmt = (
        select(Event)
        .where(Event.slug == slug)
        .options(
            selectinload(Event.videos),
            selectinload(Event.networks),
            selectinload(Event.event_games).selectinload(EventGame.game),
        )
    )
    return db.scalars(stmt).first()


def get_by_igdb_id(db: Session, igdb_id: int) -> Event | None:
    return db.scalars(select(Event).where(Event.igdb_id == igdb_id)).first()


def list_upcoming(db: Session) -> list[Event]:
    """Soonest-first, upcoming only — same window the sync job fetches, checked again here
    as a defense-in-depth filter (e.g. against a stale row from before the last prune ran)."""
    now = int(datetime.now(UTC).timestamp())
    stmt = select(Event).where(Event.end_time > now).order_by(Event.start_time.asc())
    return list(db.scalars(stmt))


def upsert_from_igdb_payload(db: Session, payload: dict) -> Event:
    """Find-or-create by igdb_id, set scalars, then fully replace child rows — same
    delete-then-reinsert approach game_media_repository uses for Game's screenshots/videos/
    artworks, rather than diffing."""
    igdb_id = payload["id"]
    event = get_by_igdb_id(db, igdb_id)
    if event is None:
        event = Event(igdb_id=igdb_id, name=payload.get("name") or f"Event {igdb_id}")
        db.add(event)

    event.name = payload.get("name") or event.name
    event.slug = payload.get("slug")
    event.description = payload.get("description")
    event.start_time = payload.get("start_time")
    event.end_time = payload.get("end_time")
    event.time_zone = payload.get("time_zone")
    event.live_stream_url = payload.get("live_stream_url")
    event.event_logo_url = (payload.get("event_logo") or {}).get("url")
    event.igdb_created_at = payload.get("created_at")
    event.igdb_updated_at = payload.get("updated_at")
    event.checksum = payload.get("checksum")
    db.flush()

    db.execute(delete(EventVideo).where(EventVideo.event_id == event.id))
    for video in payload.get("videos") or []:
        video_id = video.get("video_id")
        if not video_id:
            continue
        db.add(EventVideo(event_id=event.id, igdb_id=video.get("id"), name=video.get("name"), video_id=video_id))

    db.execute(delete(EventNetwork).where(EventNetwork.event_id == event.id))
    for network in payload.get("event_networks") or []:
        url = network.get("url")
        if not url:
            continue
        network_type = network.get("network_type")
        network_type_name = network_type.get("name") if isinstance(network_type, dict) else None
        db.add(
            EventNetwork(
                event_id=event.id, igdb_id=network.get("id"), network_type=network_type_name, url=url
            )
        )

    db.execute(delete(EventGame).where(EventGame.event_id == event.id))
    for igdb_game in payload.get("games") or []:
        igdb_game_id = igdb_game.get("id")
        if igdb_game_id is None:
            continue
        local_game = game_repository.get_game_by_igdb_id(db, igdb_game_id)
        db.add(
            EventGame(
                event_id=event.id,
                igdb_game_id=igdb_game_id,
                game_id=local_game.id if local_game else None,
                name=igdb_game.get("name"),
                cover_url=(igdb_game.get("cover") or {}).get("url"),
            )
        )

    db.flush()
    return event


def prune_ended(db: Session, upcoming_igdb_ids: set[int]) -> int:
    """Drops any previously-synced event that's no longer upcoming — either its stored
    end_time has passed, or IGDB's own upcoming list (upcoming_igdb_ids, the full set the
    sync just fetched) no longer includes it. The second case matters when IGDB corrects an
    event's dates after we synced it: e.g. an end_time typo'd a year late, later fixed to
    one that's already passed, drops the event out of get_upcoming_events entirely, so it's
    never re-upserted and its stale future end_time alone would keep it on the Dashboard
    forever. Cascades to child tables via each relationship's cascade="all, delete-orphan"."""
    now = int(datetime.now(UTC).timestamp())
    stmt = select(Event).where(
        or_(
            and_(Event.end_time.is_not(None), Event.end_time <= now),
            Event.igdb_id.not_in(upcoming_igdb_ids),
        )
    )
    ended = list(db.scalars(stmt))
    for event in ended:
        db.delete(event)
    db.flush()
    return len(ended)
