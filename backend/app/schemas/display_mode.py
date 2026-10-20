from pydantic import Field, field_validator

from app.schemas.base import CamelModel

MEDIA_COVER_ART = "cover_art"
MEDIA_SCREENSHOT = "screenshot"
MEDIA_ARTWORK = "artwork"
MEDIA_VIDEO = "video"

MEDIA_TYPES = (MEDIA_COVER_ART, MEDIA_SCREENSHOT, MEDIA_ARTWORK, MEDIA_VIDEO)


class DisplayModeSlide(CamelModel):
    """One Display Mode slide: a single media item (cover art, screenshot,
    artwork, or video) from an owned game."""

    id: int
    name: str
    media_type: str
    media_url: str


class DisplayModeSettingsResponse(CamelModel):
    slide_interval_seconds: int
    show_title: bool
    show_hidden: bool
    show_wishlisted: bool
    media_cover_art: bool
    media_screenshots: bool
    media_artwork: bool
    media_videos: bool
    volume: int


class DisplayModeSettingsUpdate(CamelModel):
    slide_interval_seconds: int | None = Field(default=None, ge=3, le=120)
    show_title: bool | None = None
    show_hidden: bool | None = None
    show_wishlisted: bool | None = None
    media_cover_art: bool | None = None
    media_screenshots: bool | None = None
    media_artwork: bool | None = None
    media_videos: bool | None = None
    volume: int | None = Field(default=None, ge=0)

    @field_validator("volume")
    @classmethod
    def clamp_volume(cls, v: int | None) -> int | None:
        # Volumes above the max are clamped (the slider can't send them, but
        # the API is lenient); negatives are still rejected by ge=0.
        if v is not None and v > 100:
            return 100
        return v
