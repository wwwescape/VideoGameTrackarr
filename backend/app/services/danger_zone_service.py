"""Settings → General → Danger Zone: clear one kind of your data, or reset the game library,
the hardware or everything. Each says exactly what it removes; the three resets take a
safety snapshot first (backup_service.write_safety_snapshot), restorable like any backup.
Your account, settings and integration setup are never touched."""

import enum
from dataclasses import dataclass, field

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models.catalog import Collection, Franchise, Game
from app.models.events import EventGame
from app.models.hardware import (
    Accessory,
    AccessoryAccessoryLink,
    AccessoryCompatibility,
    AccessoryDeviceLink,
    AccessoryNote,
    AccessoryTag,
    Device,
    DeviceNote,
    DeviceTag,
    UserAccessory,
    UserDevice,
)
from app.models.igdb_import import IgdbImportEntry
from app.models.itad import ItadPriceCache
from app.models.library import GameProgress, GameTag, Note, PlaySession, Tag
from app.models.platprices import PlatPricesCache
from app.models.steam import SteamLibraryEntry, SteamWishlistEntry
from app.repositories import game_repository
from app.services import backup_service, rom_service, upload_service
from app.services.exceptions import ConflictError


class DangerZoneAction(enum.Enum):
    CLEAR_PROGRESS = "clear_progress"
    CLEAR_RATINGS = "clear_ratings"
    CLEAR_NOTES = "clear_notes"
    CLEAR_TAGS = "clear_tags"
    CLEAR_SYNC_CACHES = "clear_sync_caches"
    RESET_LIBRARY = "reset_library"
    RESET_HARDWARE = "reset_hardware"
    RESET_EVERYTHING = "reset_everything"


# The ones that need RESET typed and take a safety snapshot first.
RESET_ACTIONS = {DangerZoneAction.RESET_LIBRARY, DangerZoneAction.RESET_HARDWARE, DangerZoneAction.RESET_EVERYTHING}
RESET_CONFIRMATION = "RESET"


@dataclass
class DangerZoneResult:
    # How many of each kind were removed (or cleared), e.g. {"games": 12}.
    removed: dict[str, int] = field(default_factory=dict)
    safety_snapshot_path: str | None = None


def run(db: Session, action: DangerZoneAction, confirmation: str | None = None) -> DangerZoneResult:
    if action in RESET_ACTIONS and confirmation != RESET_CONFIRMATION:
        raise ConflictError(f"Type {RESET_CONFIRMATION} to confirm")
    result = DangerZoneResult()
    if action in RESET_ACTIONS:
        result.safety_snapshot_path = str(backup_service.write_safety_snapshot(db, label=f"reset-{action.value}"))

    rom_files: list[str] = []
    uploads: list[str | None] = []
    if action is DangerZoneAction.CLEAR_PROGRESS:
        _clear_progress(db, result)
    elif action is DangerZoneAction.CLEAR_RATINGS:
        result.removed["ratings"] = _count(
            db, update(Game).where(Game.user_rating.is_not(None)).values(user_rating=None)
        )
    elif action is DangerZoneAction.CLEAR_NOTES:
        _clear_notes(db, result)
    elif action is DangerZoneAction.CLEAR_TAGS:
        _clear_tags(db, result)
    elif action is DangerZoneAction.CLEAR_SYNC_CACHES:
        _clear_sync_caches(db, result)
    elif action is DangerZoneAction.RESET_LIBRARY:
        rom_files, uploads = _reset_library(db, result)
    elif action is DangerZoneAction.RESET_HARDWARE:
        uploads = _reset_hardware(db, result)
    else:
        rom_files, uploads = _reset_library(db, result)
        uploads += _reset_hardware(db, result)
        _clear_tags(db, result)
        _clear_sync_caches(db, result, keep_ignored=False)
    db.commit()

    # Files go only once the rows are gone for good.
    rom_service.delete_files(rom_files)
    for url in uploads:
        upload_service.delete_if_local_upload(url)
    return result


def _count(db: Session, statement) -> int:
    """Runs a bulk delete/update and returns how many rows it changed."""
    return db.execute(statement).rowcount or 0


def _clear_progress(db: Session, result: DangerZoneResult) -> None:
    """Play status, playtime, dates and reviews (each platform's progress) and play sessions."""
    result.removed["progress"] = _count(db, delete(GameProgress))
    result.removed["playSessions"] = _count(db, delete(PlaySession))


def _clear_notes(db: Session, result: DangerZoneResult) -> None:
    """Every note on a game, device or accessory. A copy's own short notes field stays."""
    result.removed["notes"] = (
        _count(db, delete(Note)) + _count(db, delete(DeviceNote)) + _count(db, delete(AccessoryNote))
    )


def _clear_tags(db: Session, result: DangerZoneResult) -> None:
    """Every tag, and every game, device and accessory it was on."""
    db.execute(delete(GameTag))
    db.execute(delete(DeviceTag))
    db.execute(delete(AccessoryTag))
    result.removed["tags"] = result.removed.get("tags", 0) + _count(db, delete(Tag))


def _clear_sync_caches(db: Session, result: DangerZoneResult, keep_ignored: bool = True) -> None:
    """Steam Sync's library and wishlist, IGDB Import's matches and the price caches — all
    fetched again on their next run. Ignoring a game there is your choice, not cached data,
    so those rows stay (except for Reset everything)."""
    removed = 0
    for model, flag in (
        (SteamLibraryEntry, SteamLibraryEntry.dismissed),
        (SteamWishlistEntry, SteamWishlistEntry.dismissed),
        (IgdbImportEntry, IgdbImportEntry.dismissed),
        (ItadPriceCache, ItadPriceCache.ignored),
        (PlatPricesCache, PlatPricesCache.ignored),
    ):
        statement = delete(model).where(flag.is_(False)) if keep_ignored else delete(model)
        removed += _count(db, statement)
    result.removed["cacheEntries"] = result.removed.get("cacheEntries", 0) + removed


def _reset_library(db: Session, result: DangerZoneResult) -> tuple[list[str], list[str | None]]:
    """Every game and everything on it — copies, ROMs and saves, progress, sessions, ratings,
    notes, tags on games, add-ons, catalog details — plus the Collections and Series that only
    existed for them. Returns the ROM files and uploaded covers to delete afterwards."""
    games = list(db.execute(select(Game.id, Game.cover_url)))
    covers = [cover for _id, cover in games]
    # Caches and links keyed on these games (Events keep their own list of IGDB games).
    db.execute(update(EventGame).values(game_id=None))
    db.execute(delete(SteamLibraryEntry))
    db.execute(delete(SteamWishlistEntry))
    db.execute(delete(ItadPriceCache))
    db.execute(delete(PlatPricesCache))
    rom_files = game_repository._delete_games(db, [game_id for game_id, _cover in games]) if games else []
    db.execute(delete(Collection))
    db.execute(delete(Franchise))
    result.removed["games"] = len(games)
    return rom_files, covers


def _reset_hardware(db: Session, result: DangerZoneResult) -> list[str | None]:
    """Every device and accessory, with their units, notes, tags and links. The hardware
    reference list and its lookups stay. Returns the uploaded accessory photos to delete."""
    photos = list(db.scalars(select(Accessory.image_url)))
    devices = _count(db, delete(UserDevice))
    accessories = _count(db, delete(UserAccessory))
    for model in (DeviceTag, DeviceNote, AccessoryTag, AccessoryNote, AccessoryDeviceLink, AccessoryAccessoryLink):
        db.execute(delete(model))
    db.execute(delete(AccessoryCompatibility))
    db.execute(delete(Device))
    db.execute(delete(Accessory))
    result.removed["devices"] = devices
    result.removed["accessories"] = accessories
    return photos
