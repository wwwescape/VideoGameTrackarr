from typing import Literal

from app.schemas.base import CamelModel


class CatalogResyncProgressResponse(CamelModel):
    current: int
    total: int


class CatalogResyncFailureResponse(CamelModel):
    igdb_id: int
    error: str


class CatalogResyncResultResponse(CamelModel):
    total_candidates: int
    added: int
    skipped_existing: int
    failed: int
    failures: list[CatalogResyncFailureResponse]


class CatalogResyncStatusResponse(CamelModel):
    status: Literal["idle", "running", "completed", "failed"]
    kind: Literal["collection", "franchise"] | None
    ref_slug: str | None
    ref_name: str | None
    started_at: str | None
    finished_at: str | None
    progress: CatalogResyncProgressResponse | None
    result: CatalogResyncResultResponse | None
    error: str | None
