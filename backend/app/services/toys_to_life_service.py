from sqlalchemy.orm import Session

from app.models.catalog import Game
from app.models.library import LibraryStatus, Tag
from app.models.toys_to_life import ToysToLifeCopy, ToysToLifeItem, ToysToLifeNote
from app.repositories import game_repository, tag_repository, toys_to_life_repository
from app.services.exceptions import NotFoundError
from app.services.toys_to_life_lines import LINES, ToysToLifeLine, get_line, line_for_parent_igdb_id


def list_lines(db: Session) -> list[tuple[ToysToLifeLine, Game | None, tuple[int, int, int]]]:
    """Every line with its parent game (when it's in your library) and its
    (packs, owned, wishlisted) counts."""
    counts = toys_to_life_repository.line_counts(db)
    return [
        (line, game_repository.get_game_by_igdb_id(db, line.parent_igdb_id), counts.get(line.slug, (0, 0, 0)))
        for line in LINES
    ]


def list_items(
    db: Session,
    line_slug: str,
    *,
    search: str | None = None,
    pack_types: list[str] | None = None,
    status: LibraryStatus | None = None,
) -> list[ToysToLifeItem]:
    line = require_line(line_slug)
    return toys_to_life_repository.list_items(db, line.slug, search=search, pack_types=pack_types, status=status)


def get_item_detail(
    db: Session, line_slug: str, set_number: str
) -> tuple[ToysToLifeItem, ToysToLifeLine, Game | None, list[Tag]]:
    line = require_line(line_slug)
    item = toys_to_life_repository.get_item_by_set_number(db, line.slug, set_number)
    if item is None:
        raise NotFoundError(f"{line.name} pack {set_number} not found")
    parent = game_repository.get_game_by_igdb_id(db, line.parent_igdb_id)
    return item, line, parent, tag_repository.list_tags_for_toy(db, item.id)


def get_game_section(db: Session, game_id: int) -> tuple[ToysToLifeLine, list[ToysToLifeItem]] | None:
    """The game page's Toys to Life section: the packs of the line this game is the base of
    (None for any other game). Starter kits are per platform, so only the ones for platforms
    you own the game on are in it; the line's own page lists them all."""
    game = game_repository.get_game(db, game_id)
    if game is None:
        raise NotFoundError(f"Game {game_id} not found")
    line = line_for_parent_igdb_id(game.game.igdb_id)
    if line is None:
        return None
    platforms = toys_to_life_repository.owned_platform_igdb_ids(db, game_id)
    items = [
        item
        for item in toys_to_life_repository.list_items(db, line.slug)
        if item.platform_igdb_id is None or item.platform_igdb_id in platforms
    ]
    return line, items


def create_copy(
    db: Session, item_id: int, status: LibraryStatus, price: float | None, notes: str | None
) -> ToysToLifeCopy:
    _require_item(db, item_id)
    copy = toys_to_life_repository.create_copy(db, item_id, status, price, _clean(notes))
    db.commit()
    db.refresh(copy)
    return copy


def update_copy(db: Session, copy_id: int, fields: dict) -> ToysToLifeCopy:
    """`fields` holds only what was sent; a null status is ignored (a copy always has one)."""
    if "notes" in fields:
        fields["notes"] = _clean(fields["notes"])
    if fields.get("status", True) is None:
        del fields["status"]
    copy = toys_to_life_repository.update_copy(db, _require_copy(db, copy_id), **fields)
    db.commit()
    db.refresh(copy)
    return copy


def delete_copy(db: Session, copy_id: int) -> None:
    toys_to_life_repository.delete_copy(db, _require_copy(db, copy_id))
    db.commit()


def _clean(notes: str | None) -> str | None:
    return notes.strip() or None if notes else None


def _require_copy(db: Session, copy_id: int) -> ToysToLifeCopy:
    copy = toys_to_life_repository.get_copy(db, copy_id)
    if copy is None:
        raise NotFoundError(f"Toys-to-Life copy {copy_id} not found")
    return copy


def set_user_rating(db: Session, item_id: int, rating: int | None) -> int | None:
    item = _require_item(db, item_id)
    item.user_rating = rating
    db.commit()
    return item.user_rating


def list_notes(db: Session, item_id: int) -> list[ToysToLifeNote]:
    _require_item(db, item_id)
    return toys_to_life_repository.list_notes(db, item_id)


def create_note(db: Session, item_id: int, body: str) -> ToysToLifeNote:
    _require_item(db, item_id)
    note = toys_to_life_repository.create_note(db, item_id, body)
    db.commit()
    db.refresh(note)
    return note


def update_note(db: Session, note_id: int, body: str) -> ToysToLifeNote:
    note = toys_to_life_repository.update_note(db, _require_note(db, note_id), body)
    db.commit()
    db.refresh(note)
    return note


def delete_note(db: Session, note_id: int) -> None:
    toys_to_life_repository.delete_note(db, _require_note(db, note_id))
    db.commit()


def require_line(line_slug: str) -> ToysToLifeLine:
    line = get_line(line_slug)
    if line is None:
        raise NotFoundError(f"Toys-to-Life line {line_slug} not found")
    return line


def _require_item(db: Session, item_id: int) -> ToysToLifeItem:
    item = toys_to_life_repository.get_item(db, item_id)
    if item is None:
        raise NotFoundError(f"Toys-to-Life item {item_id} not found")
    return item


def _require_note(db: Session, note_id: int) -> ToysToLifeNote:
    note = toys_to_life_repository.get_note(db, note_id)
    if note is None:
        raise NotFoundError(f"Toys-to-Life note {note_id} not found")
    return note
