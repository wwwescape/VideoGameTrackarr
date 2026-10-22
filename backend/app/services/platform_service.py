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

def _require_platform(db: Session, platform_id: int) -> Platform:
    platform = db.get(Platform, platform_id)
    if platform is None:
        raise NotFoundError(f"Platform {platform_id} not found")
    return platform


def set_platform_spine_template(db: Session, platform_id: int, spine_url: str | None) -> Platform:
    """Set (or clear, with None) the platform's Bookshelf spine template.

    Replacing or clearing removes the previous local upload so orphaned
    template files don't pile up in the uploads volume.
    """
    from app.services.upload_service import delete_spine_if_local

    platform = _require_platform(db, platform_id)
    if platform.spine_template_url and platform.spine_template_url != spine_url:
        delete_spine_if_local(platform.spine_template_url)
    platform.spine_template_url = spine_url
    db.commit()
    db.refresh(platform)
    return platform


def set_platform_case_size(
    db: Session, platform_id: int, height_mm: float | None, spine_mm: float | None
) -> Platform:
    """Set (or clear, with Nones) the platform's actual physical case size —
    Bookshelf renders its cases at a fixed 40% of this."""
    platform = _require_platform(db, platform_id)
    platform.case_height_mm = height_mm
    platform.case_spine_mm = spine_mm
    db.commit()
    db.refresh(platform)
    return platform


def set_platform_spine_style(
    db: Session,
    platform_id: int,
    color: str | None,
    icon: str | None,
    icon_url: str | None = None,
) -> Platform:
    """Set (or clear) the platform's generic-spine colour and icon. A custom
    uploaded icon image lives in spine_icon_url (icon == "custom"); changing
    or clearing it deletes the previous local upload."""
    from app.services.upload_service import delete_spine_if_local

    platform = _require_platform(db, platform_id)
    previous_icon_url = platform.spine_icon_url
    platform.spine_color = color
    platform.spine_icon = icon
    platform.spine_icon_url = icon_url if icon == "custom" else None
    db.commit()
    db.refresh(platform)
    if previous_icon_url and previous_icon_url != platform.spine_icon_url:
        delete_spine_if_local(previous_icon_url)
    return platform
