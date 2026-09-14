from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.catalog import Collection, Game, GameCategory, GameCollection
from app.models.library import MediaFormat
from app.repositories.game_repository import (
    GameSortOption,
    GameWithStatus,
    _apply_optional_game_filters,
    _is_browsable_game,
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
    """Every collection with at least one locally-known, browsable (non-addon) game — same
    _is_browsable_game/parent_game_id filter as list_games_for_collection below, so this
    count always matches what the collection's own Details page actually shows; a collection
    whose only locally-known members are addons is excluded entirely rather than showing a
    non-zero count that leads to an empty Details page."""
    stmt = (
        select(Collection, func.count(func.distinct(GameCollection.game_id)))
        .join(GameCollection, GameCollection.collection_id == Collection.id)
        .join(Game, Game.id == GameCollection.game_id)
        .where(Game.parent_game_id.is_(None), _is_browsable_game(Game.category))
        .group_by(Collection.id)
        .order_by(Collection.name)
    )
    return [(collection, count) for collection, count in db.execute(stmt)]


def list_games_for_collection(db: Session, collection_id: int) -> list[GameWithStatus]:
    """Only games already locally known, and only browsable (non-addon) ones — same
    parent_game_id/category filter as game_repository.list_top_level_games, so a DLC/
    expansion/pack that happens to share this collection with its parent game doesn't clutter
    the collection's game grid; it's still reachable via its parent's own Addons tab."""
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .join(GameCollection, GameCollection.game_id == Game.id)
        .where(
            GameCollection.collection_id == collection_id,
            Game.parent_game_id.is_(None),
            _is_browsable_game(Game.category),
        )
        .order_by(Game.name)
    )
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]


def list_addons_for_collection(
    db: Session,
    collection_id: int,
    *,
    search: str | None = None,
    platform_ids: list[int] | None = None,
    platform_exclude: bool = False,
    tag_ids: list[int] | None = None,
    tag_exclude: bool = False,
    collection_ids: list[int] | None = None,
    collection_exclude: bool = False,
    franchise_ids: list[int] | None = None,
    franchise_exclude: bool = False,
    categories: list[GameCategory] | None = None,
    category_exclude: bool = False,
    formats: list[MediaFormat] | None = None,
    format_exclude: bool = False,
    storefronts: list[str] | None = None,
    storefront_exclude: bool = False,
    sort: GameSortOption = GameSortOption.NAME_ASC,
) -> list[GameWithStatus]:
    """Addons of this collection's top-level games — parent_game_id is only ever set for
    hierarchical addon categories (DLC/expansion/pack; see game_service._upsert_from_igdb_payload),
    so no extra category filter is needed here, unlike the top-level query above. An addon
    itself is never a GameCollection row (it inherits its collection through its parent), so
    this has to go via the parent ids rather than joining GameCollection directly.

    The optional filters mirror game_repository.list_top_level_games' exact set (applied via
    the same shared _apply_optional_game_filters helper) — this collection's own scope is
    already fixed by the parent_ids subquery below, so unlike list_top_level_games there's no
    required_collection_id/required_franchise_id equivalent needed here."""
    parent_ids = (
        select(Game.id)
        .join(GameCollection, GameCollection.game_id == Game.id)
        .where(
            GameCollection.collection_id == collection_id,
            Game.parent_game_id.is_(None),
            _is_browsable_game(Game.category),
        )
    )
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .where(Game.parent_game_id.in_(parent_ids))
    )
    stmt = _apply_optional_game_filters(
        stmt,
        search=search,
        platform_ids=platform_ids,
        platform_exclude=platform_exclude,
        tag_ids=tag_ids,
        tag_exclude=tag_exclude,
        collection_ids=collection_ids,
        collection_exclude=collection_exclude,
        franchise_ids=franchise_ids,
        franchise_exclude=franchise_exclude,
        categories=categories,
        category_exclude=category_exclude,
        formats=formats,
        format_exclude=format_exclude,
        storefronts=storefronts,
        storefront_exclude=storefront_exclude,
        sort=sort,
    )
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]
