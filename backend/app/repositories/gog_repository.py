from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.gog import GogLibraryEntry


def get_entry(db: Session, gog_product_id: int) -> GogLibraryEntry | None:
    return db.scalars(
        select(GogLibraryEntry).where(GogLibraryEntry.gog_product_id == gog_product_id)
    ).first()


def get_entry_by_game_id(db: Session, game_id: int) -> GogLibraryEntry | None:
    return db.scalars(select(GogLibraryEntry).where(GogLibraryEntry.game_id == game_id)).first()


def upsert_entry(db: Session, gog_product_id: int, gog_name: str) -> GogLibraryEntry:
    entry = get_entry(db, gog_product_id)
    if entry is None:
        entry = GogLibraryEntry(gog_product_id=gog_product_id)
        db.add(entry)

    entry.gog_name = gog_name
    db.flush()
    return entry


def set_game_id(db: Session, entry: GogLibraryEntry, game_id: int | None) -> GogLibraryEntry:
    entry.game_id = game_id
    db.flush()
    return entry


def set_ignored(db: Session, entry: GogLibraryEntry, ignored: bool) -> GogLibraryEntry:
    entry.dismissed = ignored
    db.flush()
    return entry


def list_all_entries(db: Session) -> list[GogLibraryEntry]:
    """Every cached GOG entry, matched or not, ignored or not — the GOG Sync page shows
    the full picture (including "no catalog match" and ignored rows), unlike the old
    review-queue's narrower "actionable only" filter. Status/actionability is computed by
    the service layer, not filtered here."""
    stmt = (
        select(GogLibraryEntry).options(joinedload(GogLibraryEntry.game)).order_by(GogLibraryEntry.gog_name)
    )
    return list(db.scalars(stmt))
