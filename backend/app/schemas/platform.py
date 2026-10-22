from pydantic import Field

from app.schemas.base import CamelModel


class PlatformResponse(CamelModel):
    id: int
    igdb_id: int | None
    name: str
    slug: str | None
    abbreviation: str | None
    # Bookshelf mode: blank spine template, actual case size, generic-spine styling.
    spine_template_url: str | None
    case_height_mm: float | None
    case_spine_mm: float | None
    spine_color: str | None
    spine_icon: str | None
    spine_icon_url: str | None


class PlatformSpineTemplateRequest(CamelModel):
    spine_url: str | None = Field(default=None, max_length=1024)


class PlatformCaseSizeRequest(CamelModel):
    height_mm: float | None = Field(default=None, gt=0, le=1000)
    spine_mm: float | None = Field(default=None, gt=0, le=500)


class PlatformSpineStyleRequest(CamelModel):
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    icon: str | None = Field(default=None, max_length=32)
    icon_url: str | None = Field(default=None, max_length=1024)


class LibraryPlatformResponse(CamelModel):
    """A Games → Platforms card: a platform with copies in your library."""

    id: int
    name: str
    slug: str | None
    abbreviation: str | None
    # Only set on a PC storefront/format card (see platform_repository.LibraryPlatformCount).
    format: str | None
    storefront: str | None
    owned_count: int
    wishlisted_count: int
