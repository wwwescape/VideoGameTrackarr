"""Manuals & Documents on devices, accessories and Toys-to-Life packs."""

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.models.documents import DocumentFormat, DocumentSource, HardwareDocumentKind
from app.models.hardware import HardwareCondition, HardwareDocument
from app.models.toys_to_life import ToysToLifeDocument
from app.schemas.base import CamelModel
from app.services import document_files, hardware_document_service
from app.services.document_files import HARDWARE_STORE
from app.services.hardware_document_service import CopyInfo


class _DocumentFields(CamelModel):
    id: int
    name: str
    kind: HardwareDocumentKind
    source: DocumentSource
    url: str | None
    # The link's host without "www." (e.g. playstation.com), for the row's subtitle.
    domain: str | None
    original_filename: str | None
    media_format: DocumentFormat | None
    size_bytes: int | None
    # A file entry whose file isn't on disk (restored from a backup without files).
    file_missing: bool
    # The owned copy it's for, if any. The frontend words it: the serial number, else the
    # condition, else "Copy N".
    copy_id: int | None
    copy_number: int | None
    created_at: datetime
    updated_at: datetime


class HardwareDocumentResponse(_DocumentFields):
    owner_type: Literal["device", "accessory"]
    owner_id: int
    copy_serial_number: str | None
    copy_condition: HardwareCondition | None


class ToysToLifeDocumentResponse(_DocumentFields):
    item_id: int


def _common(document) -> dict:
    return {
        "id": document.id,
        "name": document.name,
        "kind": document.kind,
        "source": document.source,
        "url": document.url,
        "domain": document_files.domain_of(document.url),
        "original_filename": document.original_filename,
        "media_format": document.media_format,
        "size_bytes": document.size_bytes,
        "file_missing": HARDWARE_STORE.file_missing(document),
        "created_at": document.created_at,
        "updated_at": document.updated_at,
    }


def hardware_document_from_orm(document: HardwareDocument, copies: dict[int, CopyInfo]) -> HardwareDocumentResponse:
    owner_type, owner_id = hardware_document_service.owner_of(document)
    copy_id = hardware_document_service.copy_id_of(document)
    copy = copies.get(copy_id) if copy_id is not None else None
    return HardwareDocumentResponse(
        **_common(document),
        owner_type=owner_type,
        owner_id=owner_id,
        copy_id=copy_id,
        copy_number=copy.number if copy else None,
        copy_serial_number=copy.serial_number if copy else None,
        copy_condition=copy.condition if copy else None,
    )


def toys_to_life_document_from_orm(
    document: ToysToLifeDocument, copy_numbers: dict[int, int]
) -> ToysToLifeDocumentResponse:
    return ToysToLifeDocumentResponse(
        **_common(document),
        item_id=document.item_id,
        copy_id=document.copy_id,
        copy_number=copy_numbers.get(document.copy_id) if document.copy_id is not None else None,
    )


class DocumentLinkCreateRequest(CamelModel):
    name: str | None = Field(default=None, max_length=document_files.MAX_NAME_LENGTH)
    kind: HardwareDocumentKind = HardwareDocumentKind.MANUAL
    copy_id: int | None = None
    url: str = Field(max_length=document_files.MAX_URL_LENGTH)


class DocumentUpdateRequest(CamelModel):
    """Only the fields sent change; `copyId: null` clears the copy. Sending `url` on a file
    entry turns it into a link (its file is deleted)."""

    name: str | None = Field(default=None, max_length=document_files.MAX_NAME_LENGTH)
    kind: HardwareDocumentKind | None = None
    copy_id: int | None = None
    url: str | None = Field(default=None, max_length=document_files.MAX_URL_LENGTH)
