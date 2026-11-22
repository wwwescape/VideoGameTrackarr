from pydantic import Field, field_validator

from app.models.catalog import GameCategory
from app.schemas.base import CamelModel
from app.services.store_urls import store_field_for_url


def _check_store_url(value: str | None) -> str | None:
    """A custom add-on's Store URL must be a link to a store VGT knows (see store_urls)."""
    if value is None or not value.strip():
        return None
    if store_field_for_url(value) is None:
        raise ValueError("Store URL must be a Steam, Xbox, PlayStation, Nintendo, Epic Games or GOG store link")
    return value.strip()


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
    # One store link (an add-on's store page); stored in the matching store's column.
    store_url: str | None = Field(default=None, max_length=1024)
    developed_by: list[str] = Field(default_factory=list)
    published_by: list[str] = Field(default_factory=list)
    platform_names: list[str] = Field(default_factory=list)
    notes: str | None = None
    # Set when this game originates from Insights → Steam Sync's "Add as custom game" —
    # links the originating SteamLibraryEntry to the new game so its Steam store page shows
    # up on the game's own details page (see manual_game_service.create_manual_game).
    steam_app_id: int | None = None
    # The same link for GOG Sync's "Add as custom game" (see gog_service.link_custom_game).
    gog_product_id: int | None = None
    # Uploaded with POST /api/uploads/game-media, in display order (the first artwork is the
    # hero background). Up to 10 of each — see manual_game_service._check_media.
    screenshot_urls: list[str] = Field(default_factory=list)
    artwork_urls: list[str] = Field(default_factory=list)
    videos: list[ManualGameVideo] = Field(default_factory=list)

    _store_url = field_validator("store_url")(_check_store_url)


class ManualGameUpdateRequest(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=512)
    category: GameCategory | None = None
    first_release_date: int | None = None
    summary: str | None = None
    storyline: str | None = None
    edition: str | None = None
    cover_url: str | None = None
    parent_game_id: int | None = None
    # Replaces the store link; null or "" clears it.
    store_url: str | None = Field(default=None, max_length=1024)
    developed_by: list[str] | None = None
    published_by: list[str] | None = None
    platform_names: list[str] | None = None
    notes: str | None = None
    # The whole new list each (None leaves it as it is).
    screenshot_urls: list[str] | None = None
    artwork_urls: list[str] | None = None
    videos: list[ManualGameVideo] | None = None

    _store_url = field_validator("store_url")(_check_store_url)
