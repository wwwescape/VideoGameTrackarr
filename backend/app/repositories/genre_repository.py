from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.catalog import GameGenre, Genre


def get_or_create_by_igdb(db: Session, igdb_id: int, name: str, slug: str | None) -> Genre:
    genre = db.scalars(select(Genre).where(Genre.igdb_id == igdb_id)).first()
    if genre is None:
        genre = Genre(igdb_id=igdb_id, name=name, slug=slug)
        db.add(genre)
        db.flush()
        return genre

    genre.name = name
    genre.slug = slug
    db.flush()
    return genre


def sync_for_game(db: Session, game_id: int, genre_ids: list[int]) -> None:
    """Replaces this game's genre associations wholesale — correct for a resync, where
    IGDB's own genre list for the game is the new source of truth, not something to merge
    with whatever was previously recorded."""
    db.execute(delete(GameGenre).where(GameGenre.game_id == game_id))
    for genre_id in genre_ids:
        db.add(GameGenre(game_id=game_id, genre_id=genre_id))
    db.flush()
