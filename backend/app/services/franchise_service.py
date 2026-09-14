from typing import Any

from sqlalchemy.orm import Session

from app.models.catalog import Franchise
from app.repositories import franchise_repository
from app.repositories.game_repository import GameWithStatus
from app.services.exceptions import NotFoundError


def get_franchise_with_games(
    db: Session, slug: str
) -> tuple[Franchise, list[GameWithStatus], list[GameWithStatus]]:
    franchise = franchise_repository.get_by_slug(db, slug)
    if franchise is None:
        raise NotFoundError(f"Franchise {slug} not found")
    return (
        franchise,
        franchise_repository.list_games_for_franchise(db, franchise.id),
        franchise_repository.list_addons_for_franchise(db, franchise.id),
    )


def list_franchises(db: Session) -> list[tuple[Franchise, int]]:
    return franchise_repository.list_franchises_with_counts(db)


def list_franchise_addons(db: Session, slug: str, **filters: Any) -> list[GameWithStatus]:
    franchise = franchise_repository.get_by_slug(db, slug)
    if franchise is None:
        raise NotFoundError(f"Franchise {slug} not found")
    return franchise_repository.list_addons_for_franchise(db, franchise.id, **filters)
