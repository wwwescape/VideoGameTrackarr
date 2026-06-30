from dataclasses import dataclass

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models.catalog import Artwork, GameVideo, IgdbReleaseRegion, ReleaseDate, Screenshot


def sync_screenshots(db: Session, game_id: int, screenshots: list[tuple[int, str]]) -> None:
    """screenshots: (igdb_id, url) pairs."""
    db.execute(delete(Screenshot).where(Screenshot.game_id == game_id))
    for igdb_id, url in screenshots:
        db.add(Screenshot(game_id=game_id, igdb_id=igdb_id, url=url))
    db.flush()


def sync_artworks(db: Session, game_id: int, artworks: list[tuple[int, str]]) -> None:
    """artworks: (igdb_id, url) pairs."""
    db.execute(delete(Artwork).where(Artwork.game_id == game_id))
    for igdb_id, url in artworks:
        db.add(Artwork(game_id=game_id, igdb_id=igdb_id, url=url))
    db.flush()


def sync_videos(db: Session, game_id: int, videos: list[tuple[int, str | None, str]]) -> None:
    """videos: (igdb_id, name, youtube_video_id) triples."""
    db.execute(delete(GameVideo).where(GameVideo.game_id == game_id))
    for igdb_id, name, video_id in videos:
        db.add(GameVideo(game_id=game_id, igdb_id=igdb_id, name=name, video_id=video_id))
    db.flush()


@dataclass
class ReleaseDateInput:
    igdb_id: int
    date: int | None
    human: str | None
    platform_id: int | None
    release_region: IgdbReleaseRegion | None


def sync_release_dates(db: Session, game_id: int, release_dates: list[ReleaseDateInput]) -> None:
    db.execute(delete(ReleaseDate).where(ReleaseDate.game_id == game_id))
    for rd in release_dates:
        db.add(
            ReleaseDate(
                game_id=game_id,
                igdb_id=rd.igdb_id,
                date=rd.date,
                human=rd.human,
                platform_id=rd.platform_id,
                release_region=rd.release_region,
            )
        )
    db.flush()
