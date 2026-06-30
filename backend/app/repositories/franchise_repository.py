from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.catalog import Franchise, Game, GameFranchise
from app.repositories.game_repository import (
    GameWithStatus,
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
    """Every franchise with at least one locally-known game — the join against
    GameFranchise is what excludes franchises nothing has ever been synced into."""
    stmt = (
        select(Franchise, func.count(func.distinct(GameFranchise.game_id)))
        .join(GameFranchise, GameFranchise.franchise_id == Franchise.id)
        .group_by(Franchise.id)
        .order_by(Franchise.name)
    )
    return [(franchise, count) for franchise, count in db.execute(stmt)]


def list_games_for_franchise(db: Session, franchise_id: int) -> list[GameWithStatus]:
    """Only games already locally known — a franchise can have dozens of entries on IGDB,
    most of which this app has never heard of unless the user imported them. Computes
    owned/wishlisted/play_status/rating in the same query, same pattern as
    game_repository.list_top_level_games, rather than returning bare Game rows a caller
    would have to re-enrich."""
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .join(GameFranchise, GameFranchise.game_id == Game.id)
        .where(GameFranchise.franchise_id == franchise_id)
        .order_by(Game.name)
    )
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]
