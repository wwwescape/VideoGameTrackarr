from typing import Any

from sqlalchemy import case, exists, func, select
from sqlalchemy.orm import Session

from app.models.catalog import Game, GameCollection, GameFranchise
from app.models.library import LibraryItem
from app.repositories.game_repository import _is_browsable_game

# How many covers a Collections/Series card shows (a 2×2 grid).
MAX_COVERS = 4


def _cover_urls_by_owner(db: Session, owner_column: Any, junction_game_id: Any) -> dict[int, list[str]]:
    """Up to MAX_COVERS cover URLs per collection/franchise: games you have a copy of (owned or
    wishlisted) first, then the earliest released, with undated games last. Only browsable,
    top-level games with a cover, the same games the card's count and page cover."""
    has_copy = exists().where(LibraryItem.game_id == Game.id)
    rank = (
        func.row_number()
        .over(
            partition_by=owner_column,
            order_by=(
                case((has_copy, 0), else_=1),
                case((Game.first_release_date.is_(None), 1), else_=0),
                Game.first_release_date,
                Game.name,
            ),
        )
        .label("rank")
    )
    ranked = (
        select(owner_column.label("owner_id"), Game.cover_url.label("cover_url"), rank)
        .join(Game, Game.id == junction_game_id)
        .where(Game.parent_game_id.is_(None), _is_browsable_game(Game.category), Game.cover_url.is_not(None))
        .subquery()
    )
    stmt = (
        select(ranked.c.owner_id, ranked.c.cover_url)
        .where(ranked.c.rank <= MAX_COVERS)
        .order_by(ranked.c.owner_id, ranked.c.rank)
    )
    covers: dict[int, list[str]] = {}
    for owner_id, cover_url in db.execute(stmt):
        covers.setdefault(owner_id, []).append(cover_url)
    return covers


def cover_urls_by_collection(db: Session) -> dict[int, list[str]]:
    return _cover_urls_by_owner(db, GameCollection.collection_id, GameCollection.game_id)


def cover_urls_by_franchise(db: Session) -> dict[int, list[str]]:
    return _cover_urls_by_owner(db, GameFranchise.franchise_id, GameFranchise.game_id)
