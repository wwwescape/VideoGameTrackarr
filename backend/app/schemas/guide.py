from datetime import datetime

from pydantic import Field

from app.models.library import GameGuide, GuideFormat, GuideKind, GuideSource
from app.schemas.base import CamelModel
from app.services import guide_service


class GuideResponse(CamelModel):
    id: int
    game_id: int
    name: str
    kind: GuideKind
    source: GuideSource
    platform_id: int | None
    platform_name: str | None
    url: str | None
    # The link's host without "www." (e.g. gamefaqs.gamespot.com), for the row's subtitle.
    domain: str | None
    original_filename: str | None
    media_format: GuideFormat | None
    size_bytes: int | None
    # A file entry whose file isn't on disk (restored from a backup without files).
    file_missing: bool
    created_at: datetime
    updated_at: datetime


def guide_from_orm(guide: GameGuide) -> GuideResponse:
    return GuideResponse(
        id=guide.id,
        game_id=guide.game_id,
        name=guide.name,
        kind=guide.kind,
        source=guide.source,
        platform_id=guide.platform_id,
        platform_name=guide.platform.name if guide.platform else None,
        url=guide.url,
        domain=guide_service.domain_of(guide.url),
        original_filename=guide.original_filename,
        media_format=guide.media_format,
        size_bytes=guide.size_bytes,
        file_missing=guide_service.file_missing(guide),
        created_at=guide.created_at,
        updated_at=guide.updated_at,
    )


class GuideLinkCreateRequest(CamelModel):
    name: str | None = Field(default=None, max_length=guide_service.MAX_NAME_LENGTH)
    kind: GuideKind = GuideKind.GUIDE
    platform_id: int | None = None
    url: str = Field(max_length=guide_service.MAX_URL_LENGTH)


class GuideUpdateRequest(CamelModel):
    """Only the fields sent change; `platformId: null` clears the platform. Sending `url` on a
    file entry turns it into a link (its file is deleted)."""

    name: str | None = Field(default=None, max_length=guide_service.MAX_NAME_LENGTH)
    kind: GuideKind | None = None
    platform_id: int | None = None
    url: str | None = Field(default=None, max_length=guide_service.MAX_URL_LENGTH)


class GuideLinkResponse(CamelModel):
    url: str


class GuideUploadOptionsResponse(CamelModel):
    """What the Add dialog checks a file against before uploading it."""

    max_upload_mb: int
    extensions: list[str]
