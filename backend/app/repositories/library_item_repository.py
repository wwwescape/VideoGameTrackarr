from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.catalog import Game
from app.models.library import LibraryItem, LibraryStatus


def list_all_library_items(db: Session) -> list[LibraryItem]:
    """Every library item across every game, for CSV export — not scoped to one game
    like list_library_items below."""
    stmt = (
        select(LibraryItem)
        .options(joinedload(LibraryItem.game), joinedload(LibraryItem.platform), joinedload(LibraryItem.region))
        .join(Game, Game.id == LibraryItem.game_id)
        .order_by(Game.name)
    )
    return list(db.scalars(stmt))


def list_library_items(db: Session, game_id: int, status: LibraryStatus | None = None) -> list[LibraryItem]:
    stmt = (
        select(LibraryItem)
        .options(joinedload(LibraryItem.platform), joinedload(LibraryItem.region))
        .where(LibraryItem.game_id == game_id)
    )
    if status is not None:
        stmt = stmt.where(LibraryItem.status == status)
    stmt = stmt.order_by(LibraryItem.id)
    return list(db.scalars(stmt))


def get_library_item(db: Session, item_id: int) -> LibraryItem | None:
    stmt = (
        select(LibraryItem)
        .options(joinedload(LibraryItem.platform), joinedload(LibraryItem.region))
        .where(LibraryItem.id == item_id)
    )
    return db.scalars(stmt).first()


def create_library_item(db: Session, **fields: Any) -> LibraryItem:
    item = LibraryItem(**fields)
    db.add(item)
    db.flush()
    return item


def update_library_item(db: Session, item: LibraryItem, **fields: Any) -> LibraryItem:
    for key, value in fields.items():
        setattr(item, key, value)
    db.flush()
    return item


def delete_library_item(db: Session, item: LibraryItem) -> None:
    db.delete(item)
    db.flush()
