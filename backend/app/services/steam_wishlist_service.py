import enum
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.models.library import LibraryStatus, MediaFormat
from app.models.steam import SteamWishlistEntry
from app.repositories import game_repository, library_item_repository, platform_repository, steam_wishlist_repository
from app.services import library_service
from app.services.exceptions import ConflictError, NotFoundError
from app.services.steam_service import PC_IGDB_PLATFORM_ID


class SteamWishlistEntryStatus(enum.StrEnum):
    NO_MATCH = "no_match"
    NEW = "new"
    ALREADY_WISHLISTED = "already_wishlisted"
    IGNORED = "ignored"


@dataclass
class SteamWishlistEntryWithStatus:
    entry: SteamWishlistEntry
    status: SteamWishlistEntryStatus


def list_entries(db: Session) -> list[SteamWishlistEntryWithStatus]:
    """Same shape as steam_service.list_entries — DLC/expansion/pack entries included, the
    Steam Sync page nests them under their matched parent's row via game.parent_game_id."""
    entries = steam_wishlist_repository.list_all_entries(db)
    return [_with_status(db, entry) for entry in entries]


def sync_entries(db: Session, steam_app_ids: list[int]) -> dict[str, Any]:
    """Same explicit, user-confirmed shape as steam_service.sync_entries — a NO_MATCH id or
    an already-wishlisted id is a harmless no-op, not an error."""
    synced = 0
    failures: list[dict[str, Any]] = []
    for steam_app_id in steam_app_ids:
        try:
            entry = steam_wishlist_repository.get_entry(db, steam_app_id)
            if entry is None:
                raise NotFoundError(f"Steam wishlist app {steam_app_id} not found")
            if entry.game_id is not None:
                _sync_one(db, entry)
            synced += 1
        except Exception as exc:  # noqa: BLE001 - one bad id must not abort the batch
            db.rollback()
            failures.append({"steamAppId": steam_app_id, "error": str(exc)})

    return {"synced": synced, "failed": len(failures), "failures": failures}


def ignore_entry(db: Session, steam_app_id: int) -> SteamWishlistEntryWithStatus:
    entry = _require_entry(db, steam_app_id)
    steam_wishlist_repository.set_ignored(db, entry, True)
    db.commit()
    return _with_status(db, entry)


def relink_entry(db: Session, steam_app_id: int, game_id: int) -> SteamWishlistEntryWithStatus:
    """Same purpose as steam_service.relink_entry — repoints an already-matched wishlist entry
    at a different local game when the automatic match is wrong or has gone stale."""
    entry = _require_entry(db, steam_app_id)
    if game_repository.get_game(db, game_id) is None:
        raise NotFoundError(f"Game {game_id} not found")
    existing = steam_wishlist_repository.get_entry_by_game_id(db, game_id)
    if existing is not None and existing.steam_app_id != steam_app_id:
        raise ConflictError(f"Game {game_id} is already linked to a different Steam wishlist entry")
    steam_wishlist_repository.set_game_id(db, entry, game_id)
    db.commit()
    return _with_status(db, entry)


def unlink_entry(db: Session, steam_app_id: int) -> SteamWishlistEntryWithStatus:
    entry = _require_entry(db, steam_app_id)
    steam_wishlist_repository.set_game_id(db, entry, None)
    db.commit()
    return _with_status(db, entry)


def _sync_one(db: Session, entry: SteamWishlistEntry) -> None:
    pc_platform = platform_repository.get_or_create_by_igdb(
        db, igdb_id=PC_IGDB_PLATFORM_ID, name="PC (Microsoft Windows)", slug="win", abbreviation="PC"
    )
    already_tracked = (
        len(library_item_repository.list_library_items(db, entry.game_id, status=LibraryStatus.WISHLIST)) > 0
    )
    if not already_tracked:
        library_service.add_library_item(
            db,
            entry.game_id,
            platform_id=pc_platform.id,
            status=LibraryStatus.WISHLIST,
            format=MediaFormat.DIGITAL,
            digital_storefront="Steam",
        )

    # Same one-level DLC cascade as steam_service._sync_one, just sourced from the wishlist
    # table instead of the owned one — a game can be wishlisted as a base game and separately
    # have a specific DLC wishlisted too. Still applies even though addons now get their own
    # row in the table too (see list_entries) — syncing just the parent should still bring
    # its wishlisted DLC along automatically.
    for addon in entry.game.addons:
        addon_entry = steam_wishlist_repository.get_entry_by_game_id(db, addon.id)
        if addon_entry is not None and not addon_entry.dismissed:
            _sync_one(db, addon_entry)


def _with_status(db: Session, entry: SteamWishlistEntry) -> SteamWishlistEntryWithStatus:
    if entry.dismissed:
        return SteamWishlistEntryWithStatus(entry, SteamWishlistEntryStatus.IGNORED)

    if entry.game_id is None:
        return SteamWishlistEntryWithStatus(entry, SteamWishlistEntryStatus.NO_MATCH)

    already_tracked = (
        len(library_item_repository.list_library_items(db, entry.game_id, status=LibraryStatus.WISHLIST)) > 0
    )
    status = (
        SteamWishlistEntryStatus.ALREADY_WISHLISTED if already_tracked else SteamWishlistEntryStatus.NEW
    )
    return SteamWishlistEntryWithStatus(entry, status)


def _require_entry(db: Session, steam_app_id: int) -> SteamWishlistEntry:
    entry = steam_wishlist_repository.get_entry(db, steam_app_id)
    if entry is None:
        raise NotFoundError(f"Steam wishlist app {steam_app_id} not found")
    return entry
