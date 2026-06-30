from pydantic import Field

from app.models.catalog import GameCategory
from app.schemas.base import CamelModel


class ManualGameCreateRequest(CamelModel):
    name: str = Field(min_length=1, max_length=512)
    category: GameCategory = GameCategory.MAIN_GAME
    first_release_date: int | None = None
    summary: str | None = None
    storyline: str | None = None
    edition: str | None = None
    cover_url: str | None = None
    parent_game_id: int | None = None
    developed_by: list[str] = Field(default_factory=list)
    published_by: list[str] = Field(default_factory=list)
    platform_names: list[str] = Field(default_factory=list)
    notes: str | None = None


class ManualGameUpdateRequest(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=512)
    category: GameCategory | None = None
    first_release_date: int | None = None
    summary: str | None = None
    storyline: str | None = None
    edition: str | None = None
    cover_url: str | None = None
    parent_game_id: int | None = None
    developed_by: list[str] | None = None
    published_by: list[str] | None = None
    platform_names: list[str] | None = None
    notes: str | None = None
