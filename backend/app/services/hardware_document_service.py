"""Manuals & Documents for devices and accessories (hardware_documents).

The file side lives in app/services/document_files.py (HARDWARE_STORE); this is the owner
and copy logic. A document belongs to exactly one device or accessory, and can also name one
of its owned copies (a receipt or warranty is for one copy). Deleting a device or accessory
deletes its documents and their files; deleting a copy only clears the link.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from typing import BinaryIO, Literal

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models.documents import HardwareDocumentKind
from app.models.hardware import Accessory, Device, HardwareCondition, HardwareDocument, UserAccessory, UserDevice
from app.services import document_files
from app.services.document_files import HARDWARE_STORE, DocumentValidationError
from app.services.exceptions import NotFoundError

OwnerType = Literal["device", "accessory"]

KIND_ORDER = {kind: index for index, kind in enumerate(HardwareDocumentKind)}


@dataclass
class CopyInfo:
    """What the row's subtitle names a copy by: its serial number, else its condition, else
    "Copy N" (its position among the owner's copies). The frontend words it."""

    number: int
    serial_number: str | None
    condition: HardwareCondition | None


def _owner_model(owner_type: OwnerType) -> type[Device] | type[Accessory]:
    return Device if owner_type == "device" else Accessory


def _copy_model(owner_type: OwnerType) -> type[UserDevice] | type[UserAccessory]:
    return UserDevice if owner_type == "device" else UserAccessory


def _copy_owner_column(owner_type: OwnerType):
    return UserDevice.device_id if owner_type == "device" else UserAccessory.accessory_id


def owner_of(document: HardwareDocument) -> tuple[OwnerType, int]:
    if document.device_id is not None:
        return "device", document.device_id
    return "accessory", document.accessory_id


def copy_id_of(document: HardwareDocument) -> int | None:
    return document.user_device_id if document.device_id is not None else document.user_accessory_id


def _require_owner(db: Session, owner_type: OwnerType, owner_id: int) -> None:
    if db.get(_owner_model(owner_type), owner_id) is None:
        raise NotFoundError(f"{owner_type.capitalize()} {owner_id} not found")


def _check_copy(db: Session, owner_type: OwnerType, owner_id: int, copy_id: int | None) -> None:
    if copy_id is None:
        return
    copy = db.get(_copy_model(owner_type), copy_id)
    if copy is None or getattr(copy, f"{owner_type}_id") != owner_id:
        raise DocumentValidationError(f"That copy isn't one of this {owner_type}'s copies")


def _set_owner(document: HardwareDocument, owner_type: OwnerType, owner_id: int, copy_id: int | None) -> None:
    if owner_type == "device":
        document.device_id, document.user_device_id = owner_id, copy_id
    else:
        document.accessory_id, document.user_accessory_id = owner_id, copy_id


def _set_copy(document: HardwareDocument, copy_id: int | None) -> None:
    if document.device_id is not None:
        document.user_device_id = copy_id
    else:
        document.user_accessory_id = copy_id


def get_document(db: Session, document_id: int) -> HardwareDocument:
    document = db.get(HardwareDocument, document_id)
    if document is None:
        raise NotFoundError(f"Document {document_id} not found")
    return document


def list_for_owner(db: Session, owner_type: OwnerType, owner_id: int) -> list[HardwareDocument]:
    """In type order (manuals first), each type by name ignoring case."""
    _require_owner(db, owner_type, owner_id)
    column = HardwareDocument.device_id if owner_type == "device" else HardwareDocument.accessory_id
    documents = db.execute(select(HardwareDocument).where(column == owner_id)).scalars().all()
    return sorted(documents, key=lambda d: (KIND_ORDER[d.kind], d.name.casefold(), d.id))


def copies_of(db: Session, owner_type: OwnerType, owner_id: int) -> dict[int, CopyInfo]:
    model = _copy_model(owner_type)
    copies = db.execute(select(model).where(_copy_owner_column(owner_type) == owner_id).order_by(model.id)).scalars()
    return {
        copy.id: CopyInfo(number=index, serial_number=copy.serial_number, condition=copy.condition)
        for index, copy in enumerate(copies, start=1)
    }


def create_file(
    db: Session,
    owner_type: OwnerType,
    owner_id: int,
    source: BinaryIO,
    original_filename: str,
    kind: HardwareDocumentKind,
    name: str | None = None,
    copy_id: int | None = None,
) -> HardwareDocument:
    _require_owner(db, owner_type, owner_id)
    _check_copy(db, owner_type, owner_id, copy_id)
    document = HardwareDocument(kind=kind)
    _set_owner(document, owner_type, owner_id, copy_id)
    HARDWARE_STORE.create_file_entry(db, document, source, original_filename, name)
    return document


def create_link(
    db: Session,
    owner_type: OwnerType,
    owner_id: int,
    url: str,
    kind: HardwareDocumentKind,
    name: str | None = None,
    copy_id: int | None = None,
) -> HardwareDocument:
    _require_owner(db, owner_type, owner_id)
    _check_copy(db, owner_type, owner_id, copy_id)
    document = HardwareDocument(kind=kind)
    _set_owner(document, owner_type, owner_id, copy_id)
    document_files.set_link_columns(document, url, name)
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def update_document(db: Session, document_id: int, changes: dict) -> HardwareDocument:
    """PATCH semantics: only the keys present change. `copy_id: None` clears the copy.
    Setting `url` on a file entry turns it into a link, and its files go once that commits."""
    document = get_document(db, document_id)
    if "copy_id" in changes:
        owner_type, owner_id = owner_of(document)
        _check_copy(db, owner_type, owner_id, changes["copy_id"])
        _set_copy(document, changes["copy_id"])
    old_files = HARDWARE_STORE.apply_changes(document, changes)
    db.commit()
    db.refresh(document)
    HARDWARE_STORE.delete_files(old_files)
    return document


def replace_file(db: Session, document_id: int, source: BinaryIO, original_filename: str) -> HardwareDocument:
    document = get_document(db, document_id)
    HARDWARE_STORE.replace_file(db, document, source, original_filename)
    return document


def delete_document(db: Session, document_id: int) -> None:
    HARDWARE_STORE.delete_entry(db, get_document(db, document_id))


# --- Bulk paths (deleting owners and copies) ------------------------------------------------


def delete_for_owners(db: Session, *, device_ids: Iterable[int] = (), accessory_ids: Iterable[int] = ()) -> int:
    """Deletes the documents of these devices/accessories in the caller's transaction; their
    files go once it commits. Returns how many rows went."""
    device_ids, accessory_ids = list(device_ids), list(accessory_ids)
    conditions = []
    if device_ids:
        conditions.append(HardwareDocument.device_id.in_(device_ids))
    if accessory_ids:
        conditions.append(HardwareDocument.accessory_id.in_(accessory_ids))
    removed = 0
    for condition in conditions:
        removed += _delete_where(db, condition)
    return removed


def delete_all(db: Session) -> int:
    """Every hardware document (resetting hardware, restoring a backup); files go on commit."""
    return _delete_where(db, None)


def _delete_where(db: Session, condition) -> int:
    files_query = select(HardwareDocument.stored_filename, HardwareDocument.rendered_filename)
    delete_query = delete(HardwareDocument)
    if condition is not None:
        files_query, delete_query = files_query.where(condition), delete_query.where(condition)
    files = [name for row in db.execute(files_query) for name in row if name]
    HARDWARE_STORE.delete_files_after_commit(db, files)
    return db.execute(delete_query).rowcount or 0


def clear_copies(db: Session, *, user_device_ids: Iterable[int] = (), user_accessory_ids: Iterable[int] = ()) -> None:
    """Called before copies are deleted: their documents stay with the device/accessory."""
    user_device_ids, user_accessory_ids = list(user_device_ids), list(user_accessory_ids)
    if user_device_ids:
        db.execute(
            update(HardwareDocument)
            .where(HardwareDocument.user_device_id.in_(user_device_ids))
            .values(user_device_id=None)
        )
    if user_accessory_ids:
        db.execute(
            update(HardwareDocument)
            .where(HardwareDocument.user_accessory_id.in_(user_accessory_ids))
            .values(user_accessory_id=None)
        )


def clear_all_copies(db: Session) -> None:
    """Every copy link, for when every copy is deleted at once."""
    db.execute(update(HardwareDocument).values(user_device_id=None, user_accessory_id=None))
