from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.steam import SteamLibraryEntry


def get_entry(db: Session, steam_app_id: int) -> SteamLibraryEntry | None:
    return db.scalars(
        select(SteamLibraryEntry).where(SteamLibraryEntry.steam_app_id == steam_app_id)
    ).first()


def get_entry_by_game_id(db: Session, game_id: int) -> SteamLibraryEntry | None:
    return db.scalars(select(SteamLibraryEntry).where(SteamLibraryEntry.game_id == game_id)).first()


def upsert_entry(
    db: Session, steam_app_id: int, steam_name: str, steam_playtime_minutes: int, steam_last_played_at: datetime | None
) -> SteamLibraryEntry:
    entry = get_entry(db, steam_app_id)
    if entry is None:
        entry = SteamLibraryEntry(steam_app_id=steam_app_id)
        db.add(entry)

    entry.steam_name = steam_name
    entry.steam_playtime_minutes = steam_playtime_minutes
    entry.steam_last_played_at = steam_last_played_at
    db.flush()
    return entry


def set_game_id(db: Session, entry: SteamLibraryEntry, game_id: int) -> SteamLibraryEntry:
    entry.game_id = game_id
    db.flush()
    return entry


def set_ignored(db: Session, entry: SteamLibraryEntry, ignored: bool) -> SteamLibraryEntry:
    entry.dismissed = ignored
    db.flush()
    return entry


def list_all_entries(db: Session) -> list[SteamLibraryEntry]:
    """Every cached Steam entry, matched or not, ignored or not — the Steam Sync page shows
    the full picture (including "no catalog match" and ignored rows), unlike the old
    review-queue's narrower "actionable only" filter. Status/actionability is computed by
    the service layer, not filtered here."""
    stmt = (
        select(SteamLibraryEntry).options(joinedload(SteamLibraryEntry.game)).order_by(SteamLibraryEntry.steam_name)
    )
    return list(db.scalars(stmt))
