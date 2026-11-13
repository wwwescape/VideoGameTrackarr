from sqlalchemy import delete, exists, func, select
from sqlalchemy.orm import Session

from app.models.catalog import GameGenre, Genre
from app.models.library import LibraryItem


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


def list_library_genres(db: Session) -> list[tuple[Genre, int]]:
    """Every genre at least one owned or wishlisted game has, with how many such games —
    the Games list's Genre filter only offers genres that can actually narrow it down,
    not every genre IGDB has ever attached to an auto-discovered or addon game."""
    stmt = (
        select(Genre, func.count(func.distinct(GameGenre.game_id)))
        .join(GameGenre, GameGenre.genre_id == Genre.id)
        .where(exists().where(LibraryItem.game_id == GameGenre.game_id))
        .group_by(Genre.id)
        .order_by(Genre.name)
    )
    return [(genre, count) for genre, count in db.execute(stmt)]
