from typing import Any

from sqlalchemy.orm import Session

from app.models.library import LibraryItem, LibraryStatus
from app.repositories import game_repository, library_item_repository
from app.services import rom_service
from app.services.exceptions import NotFoundError


def list_library_items(db: Session, game_id: int, status: LibraryStatus | None = None) -> list[LibraryItem]:
    _require_game(db, game_id)
    return library_item_repository.list_library_items(db, game_id, status=status)


def list_tracked_items(db: Session) -> list[LibraryItem]:
    return library_item_repository.list_tracked_items(db)


def list_distinct_storefronts(db: Session) -> list[str]:
    return library_item_repository.list_distinct_storefronts(db)


def add_library_item(db: Session, game_id: int, **fields: Any) -> LibraryItem:
    _require_game(db, game_id)
    item = library_item_repository.create_library_item(db, game_id=game_id, **fields)
    db.commit()
    db.refresh(item)
    return item


def update_library_item(db: Session, item_id: int, **fields: Any) -> LibraryItem:
    item = _require_library_item(db, item_id)
    item = library_item_repository.update_library_item(db, item, **fields)
    # A copy that's no longer an owned ROM/Abandonware/ISO copy can't hold a ROM — the
    # frontend warns before saving a change like this (LibraryItemDialog/GameLibrarySection).
    orphaned_files: list[str] = []
    if not rom_service.can_hold_rom(item.status, item.format):
        orphaned_files = rom_service.detach_rom(db, item)
    db.commit()
    rom_service.delete_files(orphaned_files)
    db.refresh(item)
    return item


def delete_library_item(db: Session, item_id: int) -> None:
    item = _require_library_item(db, item_id)
    orphaned_files = rom_service.detach_rom(db, item)
    library_item_repository.delete_library_item(db, item)
    db.commit()
    rom_service.delete_files(orphaned_files)


def _require_game(db: Session, game_id: int) -> None:
    if game_repository.get_game(db, game_id) is None:
        raise NotFoundError(f"Game {game_id} not found")


def _require_library_item(db: Session, item_id: int) -> LibraryItem:
    item = library_item_repository.get_library_item(db, item_id)
    if item is None:
        raise NotFoundError(f"Library item {item_id} not found")
    return item
