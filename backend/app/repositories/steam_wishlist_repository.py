from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.steam import SteamWishlistEntry


def get_entry(db: Session, steam_app_id: int) -> SteamWishlistEntry | None:
    return db.scalars(
        select(SteamWishlistEntry).where(SteamWishlistEntry.steam_app_id == steam_app_id)
    ).first()


def get_entry_by_game_id(db: Session, game_id: int) -> SteamWishlistEntry | None:
    return db.scalars(select(SteamWishlistEntry).where(SteamWishlistEntry.game_id == game_id)).first()


def upsert_entry(
    db: Session, steam_app_id: int, steam_name: str, wishlist_added_at: datetime | None
) -> SteamWishlistEntry:
    entry = get_entry(db, steam_app_id)
    if entry is None:
        entry = SteamWishlistEntry(steam_app_id=steam_app_id)
        db.add(entry)

    entry.steam_name = steam_name
    entry.wishlist_added_at = wishlist_added_at
    db.flush()
    return entry


def set_game_id(db: Session, entry: SteamWishlistEntry, game_id: int | None) -> SteamWishlistEntry:
    entry.game_id = game_id
    db.flush()
    return entry


def set_ignored(db: Session, entry: SteamWishlistEntry, ignored: bool) -> SteamWishlistEntry:
    entry.dismissed = ignored
    db.flush()
    return entry


def list_all_entries(db: Session) -> list[SteamWishlistEntry]:
    stmt = (
        select(SteamWishlistEntry)
        .options(joinedload(SteamWishlistEntry.game))
        .order_by(SteamWishlistEntry.steam_name)
    )
    return list(db.scalars(stmt))
