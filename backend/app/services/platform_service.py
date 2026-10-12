from typing import Any

from sqlalchemy.orm import Session

from app.models.catalog import Platform
from app.repositories import platform_repository
from app.repositories.game_repository import GameWithStatus
from app.services.exceptions import NotFoundError


def get_platform_with_games(db: Session, slug: str) -> tuple[Platform, list[GameWithStatus], list[GameWithStatus]]:
    platform = platform_repository.get_by_slug(db, slug)
    if platform is None:
        raise NotFoundError(f"Platform {slug} not found")
    return (
        platform,
        platform_repository.list_games_for_platform(db, platform.id),
        platform_repository.list_addons_for_platform(db, platform.id),
    )


def list_platforms(db: Session) -> list[tuple[Platform, int]]:
    return platform_repository.list_platforms_with_counts(db)


def list_platform_addons(db: Session, slug: str, **filters: Any) -> list[GameWithStatus]:
    platform = platform_repository.get_by_slug(db, slug)
    if platform is None:
        raise NotFoundError(f"Platform {slug} not found")
    return platform_repository.list_addons_for_platform(db, platform.id, **filters)
