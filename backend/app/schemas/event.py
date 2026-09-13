from app.models.events import Event
from app.schemas.base import CamelModel


class EventVideoResponse(CamelModel):
    """Shaped identically to GameVideoResponse so the frontend's existing VideoGallery
    component works unmodified for events."""

    id: int
    video_id: str
    name: str | None


class EventNetworkResponse(CamelModel):
    id: int
    network_type: str | None
    url: str


class EventGameTileResponse(CamelModel):
    igdb_game_id: int
    game_id: int | None
    name: str | None
    cover_url: str | None
    # Populated only when game_id is set — lets the frontend build a link via its existing
    # gameIdentifier({slug, uuid, name}) util, same as every other cross-reference to a Game.
    game_slug: str | None
    game_uuid: str | None


class EventSummaryResponse(CamelModel):
    id: int
    name: str
    slug: str | None
    start_time: int | None
    end_time: int | None
    event_logo_url: str | None


class EventDetailResponse(CamelModel):
    id: int
    igdb_id: int
    name: str
    slug: str | None
    start_time: int | None
    end_time: int | None
    time_zone: str | None
    event_logo_url: str | None
    description: str | None
    live_stream_url: str | None
    igdb_updated_at: int | None
    videos: list[EventVideoResponse]
    networks: list[EventNetworkResponse]
    games: list[EventGameTileResponse]


def event_summary_from_orm(event: Event) -> EventSummaryResponse:
    return EventSummaryResponse(
        id=event.id,
        name=event.name,
        slug=event.slug,
        start_time=event.start_time,
        end_time=event.end_time,
        event_logo_url=event.event_logo_url,
    )


def event_detail_from_orm(event: Event) -> EventDetailResponse:
    return EventDetailResponse(
        id=event.id,
        igdb_id=event.igdb_id,
        name=event.name,
        slug=event.slug,
        start_time=event.start_time,
        end_time=event.end_time,
        time_zone=event.time_zone,
        event_logo_url=event.event_logo_url,
        description=event.description,
        live_stream_url=event.live_stream_url,
        igdb_updated_at=event.igdb_updated_at,
        videos=[
            EventVideoResponse(id=video.id, video_id=video.video_id, name=video.name) for video in event.videos
        ],
        networks=[
            EventNetworkResponse(id=network.id, network_type=network.network_type, url=network.url)
            for network in event.networks
        ],
        games=[
            EventGameTileResponse(
                igdb_game_id=event_game.igdb_game_id,
                game_id=event_game.game_id,
                name=event_game.name,
                cover_url=event_game.cover_url,
                game_slug=event_game.game.slug if event_game.game else None,
                game_uuid=event_game.game.uuid if event_game.game else None,
            )
            for event_game in event.event_games
        ],
    )
