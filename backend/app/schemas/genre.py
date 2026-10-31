from app.models.catalog import Genre
from app.schemas.base import CamelModel


class GenreResponse(CamelModel):
    id: int
    name: str
    slug: str | None
    game_count: int


def genre_from_orm(genre: Genre, game_count: int) -> GenreResponse:
    return GenreResponse(id=genre.id, name=genre.name, slug=genre.slug, game_count=game_count)
