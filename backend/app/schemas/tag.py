from pydantic import Field

from app.models.library import Tag
from app.schemas.base import CamelModel


class TagResponse(CamelModel):
    id: int
    name: str
    color: str | None


def tag_from_orm(tag: Tag) -> TagResponse:
    return TagResponse(id=tag.id, name=tag.name, color=tag.color)


class TagCreateRequest(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    color: str | None = None
