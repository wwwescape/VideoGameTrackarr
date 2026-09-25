from pydantic import Field

from app.models.library import Tag
from app.schemas.base import CamelModel


class TagResponse(CamelModel):
    id: int
    name: str
    color: str | None
    text_color: str | None


def tag_from_orm(tag: Tag) -> TagResponse:
    return TagResponse(id=tag.id, name=tag.name, color=tag.color, text_color=tag.text_color)


class TagCoverageResponse(CamelModel):
    id: int
    name: str
    color: str | None
    text_color: str | None
    # Which of the requested games have this tag — not just a count, so the frontend can
    # union multiple tags' coverage client-side for an exact "remove from N games" preview.
    game_ids: list[int]


def tag_coverage_from_orm(tag: Tag, game_ids: list[int]) -> TagCoverageResponse:
    return TagCoverageResponse(
        id=tag.id, name=tag.name, color=tag.color, text_color=tag.text_color, game_ids=game_ids
    )


class TagCreateRequest(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    color: str | None = None
    text_color: str | None = None


class TagUpdateRequest(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    color: str | None = None
    text_color: str | None = None
