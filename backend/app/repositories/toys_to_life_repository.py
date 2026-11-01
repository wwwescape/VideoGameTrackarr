from sqlalchemy import ColumnElement, case, exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.catalog import Platform
from app.models.library import LibraryItem, LibraryStatus
from app.models.toys_to_life import ToysToLifeCopy, ToysToLifeItem, ToysToLifeNote

# Repositories only add/flush — they never commit.


def _has_copy(status: LibraryStatus) -> ColumnElement[bool]:
    return exists().where(ToysToLifeCopy.item_id == ToysToLifeItem.id, ToysToLifeCopy.status == status)


# As ToysToLifeItem.owned/wishlisted: a pack with an owned and a wishlisted copy is both, and
# counts (and filters) as both, like a game.
_OWNED = _has_copy(LibraryStatus.OWNED)
_WISHLISTED = _has_copy(LibraryStatus.WISHLIST)

# The line's own ordering: starter kits first, then by set number (= LEGO's release order).
_ORDER = (case((ToysToLifeItem.pack_type == "Starter Pack", 0), else_=1), ToysToLifeItem.set_number)


def list_items(
    db: Session,
    line: str,
    *,
    search: str | None = None,
    pack_types: list[str] | None = None,
    status: LibraryStatus | None = None,
) -> list[ToysToLifeItem]:
    stmt = select(ToysToLifeItem).options(selectinload(ToysToLifeItem.copies)).where(ToysToLifeItem.line == line)
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                ToysToLifeItem.name.ilike(pattern),
                ToysToLifeItem.set_number.ilike(pattern),
                ToysToLifeItem.franchise.ilike(pattern),
                ToysToLifeItem.minifigures.ilike(pattern),
            )
        )
    if pack_types:
        stmt = stmt.where(ToysToLifeItem.pack_type.in_(pack_types))
    if status is not None:
        stmt = stmt.where(_OWNED if status == LibraryStatus.OWNED else _WISHLISTED)
    return list(db.scalars(stmt.order_by(*_ORDER)))


def is_toy_pack(igdb_id: ColumnElement[int | None]) -> ColumnElement[bool]:
    """Whether an add-on row is one of IGDB's entries for a Toys-to-Life pack. IGDB lists most
    packs as add-ons of their line's game, but they're toys with their own pages here, not DLC,
    so every add-on list leaves them out: a game's Addons, Missing Addons, and the add-ons on
    Collection, Series and Platform pages. A row without an IGDB id (a custom add-on) is never
    a pack. Starter kits share their line's game's IGDB id, so this is for add-on rows only,
    never top-level games (it would match LEGO Dimensions itself)."""
    return exists().where(ToysToLifeItem.igdb_id == igdb_id)


def pack_igdb_ids(db: Session) -> set[int]:
    """Every pack's IGDB id, for imports to skip (see game_service.import_game_from_igdb)."""
    return set(db.scalars(select(ToysToLifeItem.igdb_id).where(ToysToLifeItem.igdb_id.is_not(None))))


def owned_platform_igdb_ids(db: Session, game_id: int) -> set[int]:
    """The IGDB ids of the platforms you own a game on, for picking its starter kits."""
    stmt = (
        select(Platform.igdb_id)
        .join(LibraryItem, LibraryItem.platform_id == Platform.id)
        .where(
            LibraryItem.game_id == game_id,
            LibraryItem.status == LibraryStatus.OWNED,
            Platform.igdb_id.is_not(None),
        )
    )
    return set(db.scalars(stmt))


def get_item(db: Session, item_id: int) -> ToysToLifeItem | None:
    stmt = select(ToysToLifeItem).options(selectinload(ToysToLifeItem.copies)).where(ToysToLifeItem.id == item_id)
    return db.scalars(stmt).first()


def get_item_by_set_number(db: Session, line: str, set_number: str) -> ToysToLifeItem | None:
    stmt = (
        select(ToysToLifeItem)
        .options(selectinload(ToysToLifeItem.copies))
        .where(ToysToLifeItem.line == line, ToysToLifeItem.set_number == set_number)
    )
    return db.scalars(stmt).first()


def line_counts(db: Session) -> dict[str, tuple[int, int, int]]:
    """{line: (packs, owned, wishlisted)} for every line that has any packs."""
    stmt = select(
        ToysToLifeItem.line,
        func.count(ToysToLifeItem.id),
        func.count(case((_OWNED, 1))),
        func.count(case((_WISHLISTED, 1))),
    ).group_by(ToysToLifeItem.line)
    return {line: (total, owned, wishlist) for line, total, owned, wishlist in db.execute(stmt)}


def upsert_item(db: Session, *, line: str, set_number: str, **fields: object) -> ToysToLifeItem:
    item = get_item_by_set_number(db, line, set_number)
    if item is None:
        item = ToysToLifeItem(line=line, set_number=set_number)
        db.add(item)
    for key, value in fields.items():
        setattr(item, key, value)
    db.flush()
    return item


def get_copy(db: Session, copy_id: int) -> ToysToLifeCopy | None:
    return db.get(ToysToLifeCopy, copy_id)


def create_copy(
    db: Session, item_id: int, status: LibraryStatus, price: float | None, notes: str | None
) -> ToysToLifeCopy:
    copy = ToysToLifeCopy(item_id=item_id, status=status, price=price, notes=notes)
    db.add(copy)
    db.flush()
    return copy


def update_copy(db: Session, copy: ToysToLifeCopy, **fields: object) -> ToysToLifeCopy:
    for key, value in fields.items():
        setattr(copy, key, value)
    db.flush()
    return copy


def delete_copy(db: Session, copy: ToysToLifeCopy) -> None:
    db.delete(copy)
    db.flush()


def list_notes(db: Session, item_id: int) -> list[ToysToLifeNote]:
    stmt = select(ToysToLifeNote).where(ToysToLifeNote.item_id == item_id).order_by(ToysToLifeNote.created_at.desc())
    return list(db.scalars(stmt))


def get_note(db: Session, note_id: int) -> ToysToLifeNote | None:
    return db.scalars(select(ToysToLifeNote).where(ToysToLifeNote.id == note_id)).first()


def create_note(db: Session, item_id: int, body: str) -> ToysToLifeNote:
    note = ToysToLifeNote(item_id=item_id, body=body)
    db.add(note)
    db.flush()
    return note


def update_note(db: Session, note: ToysToLifeNote, body: str) -> ToysToLifeNote:
    note.body = body
    db.flush()
    return note


def delete_note(db: Session, note: ToysToLifeNote) -> None:
    db.delete(note)
    db.flush()
