from sqlalchemy.orm import Session

from app.models.catalog import Genre
from app.repositories import genre_repository


def list_library_genres(db: Session) -> list[tuple[Genre, int]]:
    return genre_repository.list_library_genres(db)
