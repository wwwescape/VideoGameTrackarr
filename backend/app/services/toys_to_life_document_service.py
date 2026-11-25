"""Manuals & Documents for Toys-to-Life packs (toys_to_life_documents): building
instructions (Manual), receipts and other documents — TOYS_TO_LIFE_KINDS, a subset of the
hardware types.

The file side lives in app/services/document_files.py (HARDWARE_STORE, shared with devices
and accessories). A document can name one of the pack's copies; deleting that copy only clears
the link. Packs are reference data and are never deleted, so documents only go one at a time
or all together (Danger Zone).
"""

from typing import BinaryIO

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models.documents import TOYS_TO_LIFE_KINDS, HardwareDocumentKind
from app.models.toys_to_life import ToysToLifeCopy, ToysToLifeDocument, ToysToLifeItem
from app.services import document_files
from app.services.document_files import HARDWARE_STORE, DocumentValidationError
from app.services.exceptions import NotFoundError
from app.services.hardware_document_service import KIND_ORDER


def _require_item(db: Session, item_id: int) -> None:
    if db.get(ToysToLifeItem, item_id) is None:
        raise NotFoundError(f"Toys-to-Life item {item_id} not found")


def _check_kind(kind: HardwareDocumentKind | None) -> None:
    if kind is not None and kind not in TOYS_TO_LIFE_KINDS:
        allowed = ", ".join(k.value for k in TOYS_TO_LIFE_KINDS)
        raise DocumentValidationError(f"Type must be one of {allowed}")


def _check_copy(db: Session, item_id: int, copy_id: int | None) -> None:
    if copy_id is None:
        return
    copy = db.get(ToysToLifeCopy, copy_id)
    if copy is None or copy.item_id != item_id:
        raise DocumentValidationError("That copy isn't one of this pack's copies")


def get_document(db: Session, document_id: int) -> ToysToLifeDocument:
    document = db.get(ToysToLifeDocument, document_id)
    if document is None:
        raise NotFoundError(f"Document {document_id} not found")
    return document


def list_for_item(db: Session, item_id: int) -> list[ToysToLifeDocument]:
    """In type order (manuals first), each type by name ignoring case."""
    _require_item(db, item_id)
    documents = db.execute(select(ToysToLifeDocument).where(ToysToLifeDocument.item_id == item_id)).scalars().all()
    return sorted(documents, key=lambda d: (KIND_ORDER[d.kind], d.name.casefold(), d.id))


def copy_numbers(db: Session, item_id: int) -> dict[int, int]:
    """Each copy's position among the pack's copies ("Copy 2"), by id."""
    copy_ids = db.execute(
        select(ToysToLifeCopy.id).where(ToysToLifeCopy.item_id == item_id).order_by(ToysToLifeCopy.id)
    ).scalars()
    return {copy_id: index for index, copy_id in enumerate(copy_ids, start=1)}


def create_file(
    db: Session,
    item_id: int,
    source: BinaryIO,
    original_filename: str,
    kind: HardwareDocumentKind,
    name: str | None = None,
    copy_id: int | None = None,
) -> ToysToLifeDocument:
    _require_item(db, item_id)
    _check_kind(kind)
    _check_copy(db, item_id, copy_id)
    document = ToysToLifeDocument(item_id=item_id, copy_id=copy_id, kind=kind)
    HARDWARE_STORE.create_file_entry(db, document, source, original_filename, name)
    return document


def create_link(
    db: Session,
    item_id: int,
    url: str,
    kind: HardwareDocumentKind,
    name: str | None = None,
    copy_id: int | None = None,
) -> ToysToLifeDocument:
    _require_item(db, item_id)
    _check_kind(kind)
    _check_copy(db, item_id, copy_id)
    document = ToysToLifeDocument(item_id=item_id, copy_id=copy_id, kind=kind)
    document_files.set_link_columns(document, url, name)
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def update_document(db: Session, document_id: int, changes: dict) -> ToysToLifeDocument:
    """PATCH semantics: only the keys present change. `copy_id: None` clears the copy.
    Setting `url` on a file entry turns it into a link, and its files go once that commits."""
    document = get_document(db, document_id)
    _check_kind(changes.get("kind"))
    if "copy_id" in changes:
        _check_copy(db, document.item_id, changes["copy_id"])
        document.copy_id = changes["copy_id"]
    old_files = HARDWARE_STORE.apply_changes(document, changes)
    db.commit()
    db.refresh(document)
    HARDWARE_STORE.delete_files(old_files)
    return document


def replace_file(db: Session, document_id: int, source: BinaryIO, original_filename: str) -> ToysToLifeDocument:
    document = get_document(db, document_id)
    HARDWARE_STORE.replace_file(db, document, source, original_filename)
    return document


def delete_document(db: Session, document_id: int) -> None:
    HARDWARE_STORE.delete_entry(db, get_document(db, document_id))


def delete_all(db: Session) -> int:
    """Every Toys-to-Life document; their files go once the caller's transaction commits."""
    files = [
        name
        for row in db.execute(select(ToysToLifeDocument.stored_filename, ToysToLifeDocument.rendered_filename))
        for name in row
        if name
    ]
    HARDWARE_STORE.delete_files_after_commit(db, files)
    return db.execute(delete(ToysToLifeDocument)).rowcount or 0


def clear_copy(db: Session, copy_id: int) -> None:
    """Called before a copy is deleted: its documents stay with the pack."""
    db.execute(update(ToysToLifeDocument).where(ToysToLifeDocument.copy_id == copy_id).values(copy_id=None))


def clear_all_copies(db: Session) -> None:
    db.execute(update(ToysToLifeDocument).values(copy_id=None))
