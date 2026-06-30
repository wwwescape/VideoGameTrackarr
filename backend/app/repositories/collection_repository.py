from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.catalog import Collection, Game, GameCollection
from app.repositories.game_repository import (
    GameWithStatus,
    _owned_exists,
    _play_status_subquery,
    _rating_subquery,
    _row_to_game_with_status,
    _wishlisted_exists,
)


def get_or_create_by_igdb(db: Session, igdb_id: int, name: str, slug: str | None) -> Collection:
    collection = db.scalars(select(Collection).where(Collection.igdb_id == igdb_id)).first()
    if collection is None:
        collection = Collection(igdb_id=igdb_id, name=name, slug=slug)
        db.add(collection)
        db.flush()
        return collection

    collection.name = name
    collection.slug = slug
    db.flush()
    return collection


def sync_for_game(db: Session, game_id: int, collection_ids: list[int]) -> None:
    db.execute(delete(GameCollection).where(GameCollection.game_id == game_id))
    for collection_id in collection_ids:
        db.add(GameCollection(game_id=game_id, collection_id=collection_id))
    db.flush()


def get_by_id(db: Session, collection_id: int) -> Collection | None:
    return db.get(Collection, collection_id)


def get_by_slug(db: Session, slug: str) -> Collection | None:
    return db.scalars(select(Collection).where(Collection.slug == slug)).first()


def list_collections_with_counts(db: Session) -> list[tuple[Collection, int]]:
    """Every collection with at least one locally-known game — the join against
    GameCollection is what excludes collections nothing has ever been synced into."""
    stmt = (
        select(Collection, func.count(func.distinct(GameCollection.game_id)))
        .join(GameCollection, GameCollection.collection_id == Collection.id)
        .group_by(Collection.id)
        .order_by(Collection.name)
    )
    return [(collection, count) for collection, count in db.execute(stmt)]


def list_games_for_collection(db: Session, collection_id: int) -> list[GameWithStatus]:
    """Only games already locally known — same caveat as franchise_repository's
    list_games_for_franchise, which this mirrors."""
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .join(GameCollection, GameCollection.game_id == Game.id)
        .where(GameCollection.collection_id == collection_id)
        .order_by(Game.name)
    )
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]
