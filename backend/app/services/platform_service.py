from typing import Any

from sqlalchemy.orm import Session

from app.models.catalog import Platform
from app.models.library import MediaFormat
from app.repositories import platform_repository
from app.repositories.game_repository import GameWithStatus
from app.repositories.platform_repository import LibraryPlatformCount
from app.services.exceptions import NotFoundError


def list_library_platforms(db: Session) -> list[LibraryPlatformCount]:
    return platform_repository.list_library_platforms_with_counts(db)


def get_platform(db: Session, slug_or_id: str) -> Platform:
    platform = platform_repository.get_by_slug_or_id(db, slug_or_id)
    if platform is None:
        raise NotFoundError(f"Platform {slug_or_id} not found")
    return platform


def list_platform_addons(
    db: Session,
    slug_or_id: str,
    media_format: MediaFormat | None = None,
    storefront: str | None = None,
    **filters: Any,
) -> list[GameWithStatus]:
    platform = get_platform(db, slug_or_id)
    return platform_repository.list_addons_for_platform(db, platform.id, media_format, storefront, **filters)
