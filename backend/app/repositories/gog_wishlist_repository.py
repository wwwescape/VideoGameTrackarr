from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.gog import GogWishlistEntry


def get_entry(db: Session, gog_product_id: int) -> GogWishlistEntry | None:
    return db.scalars(select(GogWishlistEntry).where(GogWishlistEntry.gog_product_id == gog_product_id)).first()


def get_entry_by_game_id(db: Session, game_id: int) -> GogWishlistEntry | None:
    return db.scalars(select(GogWishlistEntry).where(GogWishlistEntry.game_id == game_id)).first()


def upsert_entry(db: Session, gog_product_id: int, gog_name: str) -> GogWishlistEntry:
    entry = get_entry(db, gog_product_id)
    if entry is None:
        entry = GogWishlistEntry(gog_product_id=gog_product_id)
        db.add(entry)

    entry.gog_name = gog_name
    db.flush()
    return entry


def set_game_id(db: Session, entry: GogWishlistEntry, game_id: int | None) -> GogWishlistEntry:
    entry.game_id = game_id
    db.flush()
    return entry


def set_ignored(db: Session, entry: GogWishlistEntry, ignored: bool) -> GogWishlistEntry:
    entry.dismissed = ignored
    db.flush()
    return entry


def list_all_entries(db: Session) -> list[GogWishlistEntry]:
    """every cached GOG wishlist entry, matched or not, ignored or not — the GOG Sync page shows the
    full picture, like Steam Sync. Status is computed by the service layer, not filtered here."""
    stmt = select(GogWishlistEntry).options(joinedload(GogWishlistEntry.game)).order_by(GogWishlistEntry.gog_name)
    return list(db.scalars(stmt))
