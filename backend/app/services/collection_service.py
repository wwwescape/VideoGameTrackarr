from sqlalchemy.orm import Session

from app.models.catalog import Collection
from app.repositories import collection_repository
from app.repositories.game_repository import GameWithStatus
from app.services.exceptions import NotFoundError


def get_collection_with_games(db: Session, slug: str) -> tuple[Collection, list[GameWithStatus]]:
    collection = collection_repository.get_by_slug(db, slug)
    if collection is None:
        raise NotFoundError(f"Collection {slug} not found")
    return collection, collection_repository.list_games_for_collection(db, collection.id)


def list_collections(db: Session) -> list[tuple[Collection, int]]:
    return collection_repository.list_collections_with_counts(db)
