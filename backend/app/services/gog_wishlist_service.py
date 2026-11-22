import enum
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.models.gog import GogWishlistEntry
from app.models.library import LibraryStatus, MediaFormat
from app.repositories import game_repository, gog_wishlist_repository, library_item_repository, platform_repository
from app.services import library_service
from app.services.exceptions import ConflictError, NotFoundError
from app.services.gog_service import GOG_STOREFRONT
from app.services.steam_service import PC_IGDB_PLATFORM_ID


class GogWishlistEntryStatus(enum.StrEnum):
    NO_MATCH = "no_match"
    NEW = "new"
    ALREADY_WISHLISTED = "already_wishlisted"
    IGNORED = "ignored"


@dataclass
class GogWishlistEntryWithStatus:
    entry: GogWishlistEntry
    status: GogWishlistEntryStatus


def list_entries(db: Session) -> list[GogWishlistEntryWithStatus]:
    """Every cached GOG wishlist entry with its status; the GOG Sync page shows them next to
    the owned ones, exactly like Steam Sync's wishlist rows."""
    return [_with_status(db, entry) for entry in gog_wishlist_repository.list_all_entries(db)]


def sync_entries(db: Session, gog_product_ids: list[int]) -> dict[str, Any]:
    """Adds each matched game to the VGT wishlist (PC, Digital, GOG). A NO_MATCH or
    already-wishlisted id is a harmless no-op."""
    synced = 0
    failures: list[dict[str, Any]] = []
    for gog_product_id in gog_product_ids:
        try:
            entry = _require_entry(db, gog_product_id)
            if entry.game_id is not None and entry.game is not None:
                _sync_one(db, entry)
                db.commit()
            synced += 1
        except Exception as exc:  # noqa: BLE001 - one bad id must not abort the batch
            db.rollback()
            failures.append({"gogProductId": gog_product_id, "error": str(exc)})
    return {"synced": synced, "failed": len(failures), "failures": failures}


def ignore_entry(db: Session, gog_product_id: int) -> GogWishlistEntryWithStatus:
    return _set_ignored(db, gog_product_id, True)


def unignore_entry(db: Session, gog_product_id: int) -> GogWishlistEntryWithStatus:
    return _set_ignored(db, gog_product_id, False)


def ignore_entries(db: Session, gog_product_ids: list[int]) -> dict[str, Any]:
    ignored = 0
    failures: list[dict[str, Any]] = []
    for gog_product_id in gog_product_ids:
        try:
            _set_ignored(db, gog_product_id, True)
            ignored += 1
        except Exception as exc:  # noqa: BLE001 - one bad id must not abort the batch
            db.rollback()
            failures.append({"gogProductId": gog_product_id, "error": str(exc)})
    return {"ignored": ignored, "failed": len(failures), "failures": failures}


def relink_entry(db: Session, gog_product_id: int, game_id: int) -> GogWishlistEntryWithStatus:
    entry = _require_entry(db, gog_product_id)
    if game_repository.get_game(db, game_id) is None:
        raise NotFoundError(f"Game {game_id} not found")
    existing = gog_wishlist_repository.get_entry_by_game_id(db, game_id)
    if existing is not None and existing.gog_product_id != gog_product_id:
        raise ConflictError(f"Game {game_id} is already linked to a different GOG wishlist entry")
    gog_wishlist_repository.set_game_id(db, entry, game_id)
    db.commit()
    return _with_status(db, entry)


def unlink_entry(db: Session, gog_product_id: int) -> GogWishlistEntryWithStatus:
    entry = _require_entry(db, gog_product_id)
    gog_wishlist_repository.set_game_id(db, entry, None)
    db.commit()
    return _with_status(db, entry)


def _set_ignored(db: Session, gog_product_id: int, ignored: bool) -> GogWishlistEntryWithStatus:
    entry = _require_entry(db, gog_product_id)
    gog_wishlist_repository.set_ignored(db, entry, ignored)
    db.commit()
    return _with_status(db, entry)


def _is_wishlisted(db: Session, game_id: int) -> bool:
    """Whether the game already has a GOG wishlist copy (Digital, storefront GOG). A wishlist
    copy for another platform or store doesn't count: each store's wishlist gets its own row
    in Your Library, the same way each store's owned copy does."""
    return any(
        item.format == MediaFormat.DIGITAL and item.digital_storefront == GOG_STOREFRONT
        for item in library_item_repository.list_library_items(db, game_id, status=LibraryStatus.WISHLIST)
    )


def _sync_one(db: Session, entry: GogWishlistEntry) -> None:
    if not _is_wishlisted(db, entry.game_id):
        pc_platform = platform_repository.get_or_create_by_igdb(
            db, igdb_id=PC_IGDB_PLATFORM_ID, name="PC (Microsoft Windows)", slug="win", abbreviation="PC"
        )
        library_service.add_library_item(
            db,
            entry.game_id,
            platform_id=pc_platform.id,
            status=LibraryStatus.WISHLIST,
            format=MediaFormat.DIGITAL,
            digital_storefront=GOG_STOREFRONT,
        )
    # Wishlisted DLC of this game come along, one level deep, like Steam Sync.
    for addon in entry.game.addons:
        addon_entry = gog_wishlist_repository.get_entry_by_game_id(db, addon.id)
        if addon_entry is not None and not addon_entry.dismissed:
            _sync_one(db, addon_entry)


def _with_status(db: Session, entry: GogWishlistEntry) -> GogWishlistEntryWithStatus:
    if entry.dismissed:
        return GogWishlistEntryWithStatus(entry, GogWishlistEntryStatus.IGNORED)
    if entry.game_id is None or entry.game is None:
        return GogWishlistEntryWithStatus(entry, GogWishlistEntryStatus.NO_MATCH)
    if _is_wishlisted(db, entry.game_id):
        return GogWishlistEntryWithStatus(entry, GogWishlistEntryStatus.ALREADY_WISHLISTED)
    return GogWishlistEntryWithStatus(entry, GogWishlistEntryStatus.NEW)


def _require_entry(db: Session, gog_product_id: int) -> GogWishlistEntry:
    entry = gog_wishlist_repository.get_entry(db, gog_product_id)
    if entry is None:
        raise NotFoundError(f"GOG wishlist product {gog_product_id} not found")
    return entry
