from sqlalchemy.orm import Session

from app.models.catalog import Game
from app.models.hardware import Accessory
from app.models.library import LibraryItem
from app.repositories import insight_repository


def find_duplicate_library_items(db: Session) -> list[list[LibraryItem]]:
    return insight_repository.find_duplicate_library_items(db)


def find_missing_dlc(db: Session) -> list[tuple[Game, list[Game]]]:
    return insight_repository.find_missing_dlc(db)


def find_accessories_without_owned_hardware(db: Session) -> list[Accessory]:
    return insight_repository.find_accessories_without_owned_hardware(db)
