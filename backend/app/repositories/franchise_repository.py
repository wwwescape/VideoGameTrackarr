from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.catalog import Franchise, Game, GameCategory, GameFranchise
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


def get_or_create_by_igdb(db: Session, igdb_id: int, name: str, slug: str | None) -> Franchise:
    franchise = db.scalars(select(Franchise).where(Franchise.igdb_id == igdb_id)).first()
    if franchise is None:
        franchise = Franchise(igdb_id=igdb_id, name=name, slug=slug)
        db.add(franchise)
        db.flush()
        return franchise

    franchise.name = name
    franchise.slug = slug
    db.flush()
    return franchise


def sync_for_game(db: Session, game_id: int, franchise_ids: list[int]) -> None:
    db.execute(delete(GameFranchise).where(GameFranchise.game_id == game_id))
    for franchise_id in franchise_ids:
        db.add(GameFranchise(game_id=game_id, franchise_id=franchise_id))
    db.flush()


def get_by_id(db: Session, franchise_id: int) -> Franchise | None:
    return db.get(Franchise, franchise_id)


def get_by_slug(db: Session, slug: str) -> Franchise | None:
    return db.scalars(select(Franchise).where(Franchise.slug == slug)).first()


def list_franchises_with_counts(db: Session) -> list[tuple[Franchise, int]]:
    """Every franchise with at least one locally-known, browsable (non-addon) game — same
    _is_browsable_game/parent_game_id filter as list_games_for_franchise below, so this count
    always matches what the franchise's own Details page actually shows; a franchise whose
    only locally-known members are addons is excluded entirely rather than showing a non-zero
    count that leads to an empty Details page."""
    stmt = (
        select(Franchise, func.count(func.distinct(GameFranchise.game_id)))
        .join(GameFranchise, GameFranchise.franchise_id == Franchise.id)
        .join(Game, Game.id == GameFranchise.game_id)
        .where(Game.parent_game_id.is_(None), _is_browsable_game(Game.category))
        .group_by(Franchise.id)
        .order_by(Franchise.name)
    )
    return [(franchise, count) for franchise, count in db.execute(stmt)]


def list_games_for_franchise(db: Session, franchise_id: int) -> list[GameWithStatus]:
    """Only games already locally known, and only browsable (non-addon) ones — a franchise
    can have dozens of entries on IGDB, most of which this app has never heard of unless the
    user imported them. Same parent_game_id/category filter as
    game_repository.list_top_level_games, so a DLC/expansion/pack that happens to share this
    franchise with its parent game doesn't clutter the franchise's game grid; it's still
    reachable via its parent's own Addons tab. Computes owned/wishlisted/play_status/rating
    in the same query, same pattern as list_top_level_games, rather than returning bare Game
    rows a caller would have to re-enrich."""
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .join(GameFranchise, GameFranchise.game_id == Game.id)
        .where(
            GameFranchise.franchise_id == franchise_id,
            Game.parent_game_id.is_(None),
            _is_browsable_game(Game.category),
        )
        .order_by(Game.name)
    )
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]


def list_addons_for_franchise(
    db: Session,
    franchise_id: int,
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
    """Addons of this franchise's top-level games — see
    collection_repository.list_addons_for_collection's docstring, same reasoning applies here
    (parent_game_id alone is enough, an addon is never itself a GameFranchise row), including
    the optional filter set mirroring list_top_level_games via the same shared helper."""
    parent_ids = (
        select(Game.id)
        .join(GameFranchise, GameFranchise.game_id == Game.id)
        .where(
            GameFranchise.franchise_id == franchise_id,
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
