from app.schemas.base import CamelModel


class PlatformResponse(CamelModel):
    id: int
    igdb_id: int | None
    name: str
    slug: str | None
    abbreviation: str | None


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
