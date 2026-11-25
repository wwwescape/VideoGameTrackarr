from datetime import datetime

from pydantic import Field

from app.models.documents import DocumentFormat, DocumentSource
from app.models.library import GameDocument, GuideKind, MediaFormat
from app.schemas.base import CamelModel
from app.services import document_files, guide_service


class GuideResponse(CamelModel):
    id: int
    game_id: int
    name: str
    kind: GuideKind
    source: DocumentSource
    platform_id: int | None
    platform_name: str | None
    # The library copy it's for, if any. The frontend words it from the copy's platform and
    # format, else "Copy N".
    copy_id: int | None
    copy_number: int | None
    copy_platform_name: str | None
    copy_format: MediaFormat | None
    url: str | None
    # The link's host without "www." (e.g. gamefaqs.gamespot.com), for the row's subtitle.
    domain: str | None
    original_filename: str | None
    media_format: DocumentFormat | None
    size_bytes: int | None
    # A file entry whose file isn't on disk (restored from a backup without files).
    file_missing: bool
    created_at: datetime
    updated_at: datetime


def guide_from_orm(guide: GameDocument, copy_numbers: dict[int, int] | None = None) -> GuideResponse:
    item = guide.library_item
    return GuideResponse(
        id=guide.id,
        game_id=guide.game_id,
        name=guide.name,
        kind=guide.kind,
        source=guide.source,
        platform_id=guide.platform_id,
        platform_name=guide.platform.name if guide.platform else None,
        copy_id=guide.library_item_id,
        copy_number=(copy_numbers or {}).get(guide.library_item_id) if item else None,
        copy_platform_name=item.platform.name if item and item.platform else None,
        copy_format=item.format if item else None,
        url=guide.url,
        domain=document_files.domain_of(guide.url),
        original_filename=guide.original_filename,
        media_format=guide.media_format,
        size_bytes=guide.size_bytes,
        file_missing=guide_service.file_missing(guide),
        created_at=guide.created_at,
        updated_at=guide.updated_at,
    )


class GuideLinkCreateRequest(CamelModel):
    name: str | None = Field(default=None, max_length=document_files.MAX_NAME_LENGTH)
    kind: GuideKind = GuideKind.GUIDE
    platform_id: int | None = None
    copy_id: int | None = None
    url: str = Field(max_length=document_files.MAX_URL_LENGTH)


class GuideUpdateRequest(CamelModel):
    """Only the fields sent change; `platformId: null` clears the platform. Sending `url` on a
    file entry turns it into a link (its file is deleted)."""

    name: str | None = Field(default=None, max_length=document_files.MAX_NAME_LENGTH)
    kind: GuideKind | None = None
    platform_id: int | None = None
    copy_id: int | None = None
    url: str | None = Field(default=None, max_length=document_files.MAX_URL_LENGTH)


class GuideLinkResponse(CamelModel):
    url: str


class GuideUploadOptionsResponse(CamelModel):
    """What the Add dialog checks a file against before uploading it."""

    max_upload_mb: int
    extensions: list[str]
