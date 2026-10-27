from sqlalchemy import case, delete, func, select
from sqlalchemy.orm import Session

from app.models.catalog import Collection, Game, GameCategory, GameCollection
from app.models.library import MediaFormat, PlayStatus
from app.repositories.game_repository import (
    GameSortOption,
    GameSource,
    GameWithStatus,
    ReleaseStatus,
    _apply_optional_game_filters,
    _is_browsable_game,
    _owned_exists,
    _play_status_subquery,
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


def list_collections_with_counts(db: Session) -> list[tuple[Collection, int, int]]:
    """Every collection with at least one locally-known, browsable (non-addon) game — same
    _is_browsable_game/parent_game_id filter as list_games_for_collection below, so this
    count always matches what the collection's own Details page actually shows; a collection
    whose only locally-known members are addons is excluded entirely rather than showing a
    non-zero count that leads to an empty Details page."""
    stmt = (
        select(
            Collection,
            func.count(func.distinct(GameCollection.game_id)),
            # How many of those you own (any copy), for the index's Complete / Missing filter.
            func.count(func.distinct(case((_owned_exists(Game.id), Game.id)))),
        )
        .join(GameCollection, GameCollection.collection_id == Collection.id)
        .join(Game, Game.id == GameCollection.game_id)
        .where(Game.parent_game_id.is_(None), _is_browsable_game(Game.category))
        .group_by(Collection.id)
        .order_by(Collection.name)
    )
    return [(collection, count, owned) for collection, count, owned in db.execute(stmt)]


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
            Game.user_rating,
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
    platform_match_all: bool = False,
    tag_ids: list[int] | None = None,
    tag_exclude: bool = False,
    tag_match_all: bool = False,
    collection_ids: list[int] | None = None,
    collection_exclude: bool = False,
    collection_match_all: bool = False,
    franchise_ids: list[int] | None = None,
    franchise_exclude: bool = False,
    franchise_match_all: bool = False,
    categories: list[GameCategory] | None = None,
    category_exclude: bool = False,
    formats: list[MediaFormat] | None = None,
    format_exclude: bool = False,
    format_match_all: bool = False,
    storefronts: list[str] | None = None,
    storefront_exclude: bool = False,
    storefront_match_all: bool = False,
    play_statuses: list[PlayStatus] | None = None,
    play_status_exclude: bool = False,
    play_status_match_all: bool = False,
    steelbook_only: bool = False,
    sources: list[GameSource] | None = None,
    source_exclude: bool = False,
    platform_scopes: list[str] | None = None,
    genre_ids: list[int] | None = None,
    genre_exclude: bool = False,
    genre_match_all: bool = False,
    release_statuses: list[ReleaseStatus] | None = None,
    release_year_from: int | None = None,
    release_year_to: int | None = None,
    local_players_min: int | None = None,
    online_multiplayer_only: bool = False,
    coop_only: bool = False,
    time_to_beat_min: int | None = None,
    time_to_beat_max: int | None = None,
    rating_min: int | None = None,
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
            Game.user_rating,
        )
        .where(Game.parent_game_id.in_(parent_ids))
    )
    stmt = _apply_optional_game_filters(
        stmt,
        search=search,
        platform_ids=platform_ids,
        platform_exclude=platform_exclude,
        platform_match_all=platform_match_all,
        tag_ids=tag_ids,
        tag_exclude=tag_exclude,
        tag_match_all=tag_match_all,
        collection_ids=collection_ids,
        collection_exclude=collection_exclude,
        collection_match_all=collection_match_all,
        franchise_ids=franchise_ids,
        franchise_exclude=franchise_exclude,
        franchise_match_all=franchise_match_all,
        categories=categories,
        category_exclude=category_exclude,
        formats=formats,
        format_exclude=format_exclude,
        format_match_all=format_match_all,
        storefronts=storefronts,
        storefront_exclude=storefront_exclude,
        storefront_match_all=storefront_match_all,
        play_statuses=play_statuses,
        play_status_exclude=play_status_exclude,
        play_status_match_all=play_status_match_all,
        steelbook_only=steelbook_only,
        sources=sources,
        source_exclude=source_exclude,
        platform_scopes=platform_scopes,
        genre_ids=genre_ids,
        genre_exclude=genre_exclude,
        genre_match_all=genre_match_all,
        release_statuses=release_statuses,
        release_year_from=release_year_from,
        release_year_to=release_year_to,
        local_players_min=local_players_min,
        online_multiplayer_only=online_multiplayer_only,
        coop_only=coop_only,
        time_to_beat_min=time_to_beat_min,
        time_to_beat_max=time_to_beat_max,
        rating_min=rating_min,
        sort=sort,
    )
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]
