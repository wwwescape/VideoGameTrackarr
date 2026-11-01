"""Moves what you tracked on IGDB's Toys-to-Life entries onto the packs themselves.

Before Toys to Life, the only way to track a LEGO Dimensions Fun Pack was as an add-on of the
game, and owning the game on a platform meant owning that platform's starter kit. Those add-on
rows are now hidden (toys_to_life_repository.is_toy_pack), so their state moves to the packs:

- each of an add-on's copies becomes a copy of the pack, owned or wishlisted as it was, with
  its price, and its other details (platform, format, date, ...) and notes as the copy's notes.
  The add-on copy is then removed so it stops counting as an owned add-on (one with ROM files
  stays);
- its rating (when the pack has none), notes and tags move to the pack;
- a copy of a line's game on a platform gives that platform's starter kit a copy, owned or
  wishlisted (owned when you have both), but only a kit with no copies of its own yet. The
  game's copy stays: it's the game.

Run once by migration d4f6a8c0e2b3 (which repeats this in SQL, as migrations don't import app
code) and after restoring a backup older than format 5, the first to carry the packs' state.
Running it twice changes nothing more: the moved add-on state is gone after the first run.
"""

from dataclasses import dataclass

from sqlalchemy import delete, exists, select
from sqlalchemy.orm import Session, joinedload

from app.models.catalog import Game, Platform, Region
from app.models.library import GameTag, LibraryItem, LibraryStatus, Note, RomFile
from app.models.toys_to_life import ToysToLifeCopy, ToysToLifeItem, ToysToLifeNote, ToysToLifeTag
from app.services.toys_to_life_lines import LINES

_FORMAT_LABELS = {
    "physical": "Physical",
    "digital": "Digital",
    "iso": "ISO",
    "rom": "ROM",
    "abandonware": "Abandonware",
    "other": "Other",
}


@dataclass
class AdoptionResult:
    packs: int = 0
    starter_kits: int = 0


def copy_notes(game_name: str, copy: LibraryItem, platform_name: str | None, region_name: str | None) -> str:
    """An add-on copy's details (all but its status and price, which the pack copy keeps as
    fields), then its own notes, so nothing is lost when the add-on copy goes."""
    fmt = copy.format.value if copy.format else None
    parts = [
        platform_name,
        _FORMAT_LABELS.get(fmt, fmt) if fmt else None,
        copy.digital_storefront,
        f"Region {region_name}" if region_name else None,
        copy.edition,
        f"Acquired {copy.acquired_at.isoformat()}" if copy.acquired_at else None,
        "Steelbook" if copy.steelbook else None,
    ]
    details = " · ".join(part for part in parts if part)
    note = f"Moved from the add-on “{game_name}”" + (f": {details}" if details else "")
    return f"{note}\n{copy.notes}" if copy.notes else note


def adopt_library_state(db: Session) -> AdoptionResult:
    """Flushes, never commits: the caller owns the transaction (a restore, the migration's test)."""
    result = AdoptionResult()
    items = db.scalars(select(ToysToLifeItem).options(joinedload(ToysToLifeItem.copies))).unique().all()
    packs = {item.igdb_id: item for item in items if item.platform_igdb_id is None and item.igdb_id is not None}
    starter_kits = {(item.igdb_id, item.platform_igdb_id): item for item in items if item.platform_igdb_id is not None}
    line_games = {line.parent_igdb_id for line in LINES}

    for game in db.scalars(select(Game).where(Game.igdb_id.in_(packs.keys() - line_games))):
        pack = packs[game.igdb_id]
        copies = db.execute(
            select(LibraryItem, Platform.name, Region.name)
            .outerjoin(Platform, Platform.id == LibraryItem.platform_id)
            .outerjoin(Region, Region.id == LibraryItem.region_id)
            .where(LibraryItem.game_id == game.id)
            .order_by(LibraryItem.id)
        ).all()
        notes = db.scalars(select(Note).where(Note.game_id == game.id).order_by(Note.id)).all()
        tag_ids = db.scalars(select(GameTag.tag_id).where(GameTag.game_id == game.id)).all()
        if not (copies or notes or tag_ids or game.user_rating is not None):
            continue

        if pack.user_rating is None:
            pack.user_rating = game.user_rating
        game.user_rating = None
        pack_tag_ids = set(db.scalars(select(ToysToLifeTag.tag_id).where(ToysToLifeTag.item_id == pack.id)))
        for tag_id in tag_ids:
            if tag_id not in pack_tag_ids:
                db.add(ToysToLifeTag(item_id=pack.id, tag_id=tag_id))
        db.execute(delete(GameTag).where(GameTag.game_id == game.id))
        for note in notes:
            db.add(ToysToLifeNote(item_id=pack.id, body=note.body))
            db.delete(note)
        for copy, platform_name, region_name in copies:
            db.add(
                ToysToLifeCopy(
                    item_id=pack.id,
                    status=copy.status,
                    price=copy.price,
                    notes=copy_notes(game.name, copy, platform_name, region_name),
                )
            )
            if not db.scalar(select(exists().where(RomFile.library_item_id == copy.id))):
                db.delete(copy)
        result.packs += 1

    base_copies = db.execute(
        select(Game.igdb_id, Platform.igdb_id, LibraryItem.status)
        .join(LibraryItem, LibraryItem.game_id == Game.id)
        .join(Platform, Platform.id == LibraryItem.platform_id)
        .where(Game.igdb_id.in_(line_games), Platform.igdb_id.is_not(None))
        # Owned copies first, so an owned and a wishlisted copy on one platform make it owned.
        .order_by(LibraryItem.status != LibraryStatus.OWNED)
    ).all()
    given: set[int] = set()
    for game_igdb_id, platform_igdb_id, status in base_copies:
        kit = starter_kits.get((game_igdb_id, platform_igdb_id))
        if kit is None or kit.copies or kit.id in given:
            continue
        db.add(ToysToLifeCopy(item_id=kit.id, status=status))
        given.add(kit.id)
        result.starter_kits += 1

    db.flush()
    return result
