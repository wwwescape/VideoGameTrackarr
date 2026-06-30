from typing import Any

from sqlalchemy.orm import Session

from app.models.library import LibraryItem, LibraryStatus
from app.repositories import game_repository, library_item_repository
from app.services.exceptions import NotFoundError


def list_library_items(db: Session, game_id: int, status: LibraryStatus | None = None) -> list[LibraryItem]:
    _require_game(db, game_id)
    return library_item_repository.list_library_items(db, game_id, status=status)


def add_library_item(db: Session, game_id: int, **fields: Any) -> LibraryItem:
    _require_game(db, game_id)
    item = library_item_repository.create_library_item(db, game_id=game_id, **fields)
    db.commit()
    db.refresh(item)
    return item


def update_library_item(db: Session, item_id: int, **fields: Any) -> LibraryItem:
    item = _require_library_item(db, item_id)
    item = library_item_repository.update_library_item(db, item, **fields)
    db.commit()
    db.refresh(item)
    return item


def delete_library_item(db: Session, item_id: int) -> None:
    item = _require_library_item(db, item_id)
    library_item_repository.delete_library_item(db, item)
    db.commit()


def _require_game(db: Session, game_id: int) -> None:
    if game_repository.get_game(db, game_id) is None:
        raise NotFoundError(f"Game {game_id} not found")


def _require_library_item(db: Session, item_id: int) -> LibraryItem:
    item = library_item_repository.get_library_item(db, item_id)
    if item is None:
        raise NotFoundError(f"Library item {item_id} not found")
    return item
