"""Guides & Cheats: guides, cheat sheets and manuals kept with a game (game_documents).

The file side (storage, checks, conversion, serving) is shared with the hardware documents
and lives in app/services/document_files.py; this is the game-specific part. Files live in
document_files.GUIDE_STORE. Every path that removes a GameDocument row goes through a function
here or through game_repository._delete_games, whose caller removes the files once its
transaction commits — so a file on disk never outlives its row.
"""

from typing import BinaryIO

from sqlalchemy import select
from sqlalchemy import update as sql_update
from sqlalchemy.orm import Session

from app.models.catalog import Game, Platform
from app.models.library import GameDocument, GuideKind, LibraryItem
from app.services import document_files
from app.services.document_files import GUIDE_STORE, DocumentValidationError
from app.services.exceptions import NotFoundError

GUIDES_SUBDIR = GUIDE_STORE.subdir

_KIND_ORDER = {kind: index for index, kind in enumerate(GuideKind)}


def _require_game(db: Session, game_id: int) -> None:
    if db.get(Game, game_id) is None:
        raise NotFoundError(f"Game {game_id} not found")


def _check_platform(db: Session, platform_id: int | None) -> None:
    if platform_id is not None and db.get(Platform, platform_id) is None:
        raise DocumentValidationError("That platform doesn't exist")


def _check_copy(db: Session, game_id: int, library_item_id: int | None) -> None:
    if library_item_id is None:
        return
    item = db.get(LibraryItem, library_item_id)
    if item is None or item.game_id != game_id:
        raise DocumentValidationError("That copy isn't one of this game's copies")


def copy_numbers(db: Session, game_id: int) -> dict[int, int]:
    """Each library copy's position among the game's copies ("Copy 2"), by id."""
    ids = db.execute(select(LibraryItem.id).where(LibraryItem.game_id == game_id).order_by(LibraryItem.id)).scalars()
    return {item_id: index for index, item_id in enumerate(ids, start=1)}


def clear_copy(db: Session, library_item_id: int) -> None:
    """Called before a library copy is deleted: its documents stay with the game."""
    db.execute(
        sql_update(GameDocument).where(GameDocument.library_item_id == library_item_id).values(library_item_id=None)
    )


def get_guide(db: Session, guide_id: int) -> GameDocument:
    guide = db.get(GameDocument, guide_id)
    if guide is None:
        raise NotFoundError(f"Guide {guide_id} not found")
    return guide


def list_for_game(db: Session, game_id: int) -> list[GameDocument]:
    """In type order (guides, cheats, manuals, receipts, other), each by name ignoring case."""
    _require_game(db, game_id)
    guides = db.execute(select(GameDocument).where(GameDocument.game_id == game_id)).scalars().all()
    return sorted(guides, key=lambda g: (_KIND_ORDER[g.kind], g.name.casefold(), g.id))


def file_missing(guide: GameDocument) -> bool:
    return GUIDE_STORE.file_missing(guide)


def create_file(
    db: Session,
    game_id: int,
    source: BinaryIO,
    original_filename: str,
    kind: GuideKind,
    name: str | None = None,
    platform_id: int | None = None,
    library_item_id: int | None = None,
) -> GameDocument:
    _require_game(db, game_id)
    _check_platform(db, platform_id)
    _check_copy(db, game_id, library_item_id)
    guide = GameDocument(game_id=game_id, kind=kind, platform_id=platform_id, library_item_id=library_item_id)
    GUIDE_STORE.create_file_entry(db, guide, source, original_filename, name)
    return guide


def create_link(
    db: Session,
    game_id: int,
    url: str,
    kind: GuideKind,
    name: str | None = None,
    platform_id: int | None = None,
    library_item_id: int | None = None,
) -> GameDocument:
    _require_game(db, game_id)
    _check_platform(db, platform_id)
    _check_copy(db, game_id, library_item_id)
    guide = GameDocument(game_id=game_id, kind=kind, platform_id=platform_id, library_item_id=library_item_id)
    document_files.set_link_columns(guide, url, name)
    db.add(guide)
    db.commit()
    db.refresh(guide)
    return guide


def update(db: Session, guide_id: int, changes: dict) -> GameDocument:
    """PATCH semantics: only the keys present change. `platform_id: None` (or
    `library_item_id: None`) clears it. Setting
    `url` on a file entry turns it into a link, and its files go once that commits."""
    guide = get_guide(db, guide_id)
    if "platform_id" in changes:
        _check_platform(db, changes["platform_id"])
        guide.platform_id = changes["platform_id"]
    if "library_item_id" in changes:
        _check_copy(db, guide.game_id, changes["library_item_id"])
        guide.library_item_id = changes["library_item_id"]
    old_files = GUIDE_STORE.apply_changes(guide, changes)
    db.commit()
    db.refresh(guide)
    GUIDE_STORE.delete_files(old_files)
    return guide


def replace_file(db: Session, guide_id: int, source: BinaryIO, original_filename: str) -> GameDocument:
    guide = get_guide(db, guide_id)
    GUIDE_STORE.replace_file(db, guide, source, original_filename)
    return guide


def delete(db: Session, guide_id: int) -> None:
    GUIDE_STORE.delete_entry(db, get_guide(db, guide_id))
