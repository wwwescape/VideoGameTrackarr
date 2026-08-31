from sqlalchemy.orm import Session

from app.models.catalog import Game
from app.models.hardware import Accessory
from app.models.library import LibraryItem
from app.repositories import insight_repository
from app.services import itad_service, platprices_service


def find_duplicate_library_items(db: Session) -> list[list[LibraryItem]]:
    return insight_repository.find_duplicate_library_items(db)


def find_missing_dlc(db: Session) -> list[tuple[Game, list[Game]]]:
    return insight_repository.find_missing_dlc(db)


def find_accessories_without_owned_hardware(db: Session) -> list[Accessory]:
    return insight_repository.find_accessories_without_owned_hardware(db)


def get_on_sale_game_ids(db: Session) -> frozenset[int]:
    """Every game with at least one wishlisted, provider-eligible item currently on sale —
    feeds the On Sale badge shown on game cards everywhere (list, details, collections,
    series, dashboard), not just the dedicated Insights -> On Sale page."""
    itad_ids = {item.library_item.game_id for item in itad_service.list_on_sale_items(db)}
    platprices_ids = {item.library_item.game_id for item in platprices_service.list_on_sale_items(db)}
    return frozenset(itad_ids | platprices_ids)
