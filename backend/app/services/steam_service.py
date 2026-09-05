import enum
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.models.library import LibraryStatus, MediaFormat
from app.models.steam import SteamLibraryEntry
from app.repositories import library_item_repository, platform_repository, steam_repository
from app.services import library_service, progress_service
from app.services.exceptions import NotFoundError

# IGDB's platform id for "PC (Microsoft Windows)" — well-known/stable, confirmed via search
# during scoping. Resolved lazily via get_or_create_by_igdb rather than assumed present,
# same as every other IGDB-sourced platform in this app; a console-only library may never
# have imported it before now.
PC_IGDB_PLATFORM_ID = 6


class SteamEntryStatus(enum.StrEnum):
    NO_MATCH = "no_match"
    NEW = "new"
    UPDATE_AVAILABLE = "update_available"
    UP_TO_DATE = "up_to_date"
    IGNORED = "ignored"


@dataclass
class SteamEntryWithStatus:
    entry: SteamLibraryEntry
    status: SteamEntryStatus
    vgt_playtime_minutes: int | None


def list_entries(db: Session) -> list[SteamEntryWithStatus]:
    """Every cached Steam entry with a computed status — the table the Steam Sync page
    renders, DLC/expansion/pack entries included (the page nests them under their matched
    parent's row via each entry's game.parent_game_id, rather than hiding them or folding
    them into a bare count). NO_MATCH and ignored entries stay visible too, so the user has
    the complete picture of what Steam has versus what VGT knows."""
    entries = steam_repository.list_all_entries(db)
    return [_with_status(db, entry) for entry in entries]


def sync_entries(db: Session, steam_app_ids: list[int]) -> dict[str, Any]:
    """Explicit, user-confirmed apply of Steam's data to VGT — never called automatically.
    A NO_MATCH id or an already-UP_TO_DATE id is a harmless no-op, not an error, so a bulk
    selection that happens to include a non-actionable row doesn't fail the whole batch."""
    synced = 0
    failures: list[dict[str, Any]] = []
    for steam_app_id in steam_app_ids:
        try:
            entry = steam_repository.get_entry(db, steam_app_id)
            if entry is None:
                raise NotFoundError(f"Steam app {steam_app_id} not found")
            if entry.game_id is not None:
                _sync_one(db, entry)
            synced += 1
        except Exception as exc:  # noqa: BLE001 - one bad id must not abort the batch
            db.rollback()
            failures.append({"steamAppId": steam_app_id, "error": str(exc)})

    return {"synced": synced, "failed": len(failures), "failures": failures}


def ignore_entry(db: Session, steam_app_id: int) -> SteamEntryWithStatus:
    entry = _require_entry(db, steam_app_id)
    steam_repository.set_ignored(db, entry, True)
    db.commit()
    return _with_status(db, entry)


def _sync_one(db: Session, entry: SteamLibraryEntry) -> None:
    pc_platform = platform_repository.get_or_create_by_igdb(
        db, igdb_id=PC_IGDB_PLATFORM_ID, name="PC (Microsoft Windows)", slug="win", abbreviation="PC"
    )
    already_tracked = len(library_item_repository.list_library_items(db, entry.game_id, status=LibraryStatus.OWNED)) > 0
    if not already_tracked:
        library_service.add_library_item(
            db,
            entry.game_id,
            platform_id=pc_platform.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.DIGITAL,
            digital_storefront="Steam",
        )

    # A straight set to Steam's numbers, not a merge — Sync is now an explicit, confirmed
    # action (the confirmation popup shows the current-vs-new delta before this ever runs),
    # so it's allowed to actually overwrite, including downward, rather than silently
    # capping at the higher of the two like Phase 2 did. Scoped to the PC platform row only —
    # a copy owned on another platform (e.g. PS5) keeps its own separate progress untouched.
    # play_status is deliberately left at its model default (NONE) — playtime alone can't
    # tell VGT whether the user considers this backlog/playing/completed/abandoned.
    progress_service.upsert_progress_for_platform(
        db,
        entry.game_id,
        pc_platform.id,
        playtime_minutes=entry.steam_playtime_minutes,
        last_played_at=entry.steam_last_played_at.date() if entry.steam_last_played_at else None,
    )

    # Syncing a parent also syncs any of its DLC/expansion/pack children that are themselves
    # owned on Steam — one level only (Game.addons is already scoped to hierarchical
    # parent_game_id children, and addons don't have addons of their own in this app's
    # model), each addon going through the exact same owned-library-item + progress logic as
    # the parent, just recursively. This still applies even though addons now get their own
    # row in the table too (see list_entries) — a bulk "Sync selected" of just the parent
    # should still bring its owned DLC along automatically, same as before.
    for addon in entry.game.addons:
        addon_entry = steam_repository.get_entry_by_game_id(db, addon.id)
        if addon_entry is not None and not addon_entry.dismissed:
            _sync_one(db, addon_entry)


def _with_status(db: Session, entry: SteamLibraryEntry) -> SteamEntryWithStatus:
    if entry.dismissed:
        return SteamEntryWithStatus(entry, SteamEntryStatus.IGNORED, None)

    if entry.game_id is None:
        return SteamEntryWithStatus(entry, SteamEntryStatus.NO_MATCH, None)

    pc_platform = platform_repository.get_or_create_by_igdb(
        db, igdb_id=PC_IGDB_PLATFORM_ID, name="PC (Microsoft Windows)", slug="win", abbreviation="PC"
    )
    progress = progress_service.get_progress_for_platform(db, entry.game_id, pc_platform.id)
    already_tracked = len(library_item_repository.list_library_items(db, entry.game_id, status=LibraryStatus.OWNED)) > 0
    if not already_tracked:
        return SteamEntryWithStatus(entry, SteamEntryStatus.NEW, None)

    vgt_minutes = progress.playtime_minutes if progress else 0
    is_up_to_date = vgt_minutes == entry.steam_playtime_minutes
    status = SteamEntryStatus.UP_TO_DATE if is_up_to_date else SteamEntryStatus.UPDATE_AVAILABLE
    return SteamEntryWithStatus(entry, status, vgt_minutes)


def _require_entry(db: Session, steam_app_id: int) -> SteamLibraryEntry:
    entry = steam_repository.get_entry(db, steam_app_id)
    if entry is None:
        raise NotFoundError(f"Steam app {steam_app_id} not found")
    return entry
