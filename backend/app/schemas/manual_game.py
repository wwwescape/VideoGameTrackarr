from pydantic import Field

from app.models.catalog import GameCategory
from app.schemas.base import CamelModel


class ManualGameVideo(CamelModel):
    """A YouTube video, stored the way IGDB's are: its title and YouTube's 11-character id."""

    name: str | None = Field(default=None, max_length=255)
    video_id: str = Field(pattern=r"^[A-Za-z0-9_-]{11}$")


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
    # Set when this game originates from Insights → Steam Sync's "Add as custom game" —
    # links the originating SteamLibraryEntry to the new game so its Steam store page shows
    # up on the game's own details page (see manual_game_service.create_manual_game).
    steam_app_id: int | None = None
    # Uploaded with POST /api/uploads/game-media, in display order (the first artwork is the
    # hero background). Up to 10 of each — see manual_game_service._check_media.
    screenshot_urls: list[str] = Field(default_factory=list)
    artwork_urls: list[str] = Field(default_factory=list)
    videos: list[ManualGameVideo] = Field(default_factory=list)


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
    # The whole new list each (None leaves it as it is).
    screenshot_urls: list[str] | None = None
    artwork_urls: list[str] | None = None
    videos: list[ManualGameVideo] | None = None
