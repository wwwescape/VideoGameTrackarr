from typing import Any, Literal

from app.models.library import LibraryStatus, MediaFormat
from app.schemas.base import CamelModel


class BulkImportLibraryDefaults(CamelModel):
    """Step 3 of the bulk-add dialog, applied identically to every successfully-imported
    game — a deliberate subset of LibraryItemCreateRequest (just Ownership/Platform/Format/
    Digital Storefront, no Price/Region/Rating Board/Notes/etc.), per the user's own scoping."""

    status: LibraryStatus
    platform_id: int | None = None
    format: MediaFormat | None = None
    digital_storefront: str | None = None


class BulkImportRequest(CamelModel):
    igdb_ids: list[int]
    tag_ids: list[int] = []
    # None (Step 3 skipped) means no LibraryItem is created for any game — the game is
    # imported into the catalog only, same as it would be left after a normal single add
    # with no ownership set yet.
    library_defaults: BulkImportLibraryDefaults | None = None


class BulkImportProgress(CamelModel):
    current: int
    total: int


class BulkImportStatusResponse(CamelModel):
    status: Literal["idle", "running", "completed", "failed"]
    started_at: str | None
    finished_at: str | None
    progress: BulkImportProgress | None
    result: dict[str, Any] | None
    error: str | None
