from datetime import datetime

from pydantic import Field

from app.models.catalog import GameCategory
from app.schemas.base import CamelModel
from app.services.igdb_import_service import IgdbImportRow, IgdbImportStatus


class IgdbImportEntryResponse(CamelModel):
    """One custom game on IGDB Import, with what Find matches found for it."""

    game_id: int
    game_uuid: str
    game_slug: str | None
    game_name: str
    game_cover_url: str | None
    game_category: GameCategory | None
    game_first_release_date: int | None
    status: IgdbImportStatus
    match_igdb_id: int | None
    match_name: str | None
    match_cover_url: str | None
    match_first_release_date: int | None
    match_category: GameCategory | None
    exact_match_count: int
    checked_at: datetime | None
    # The library game the match is (status in_library): linking merges into it.
    library_game_name: str | None
    queued: bool


def igdb_import_entry_from_row(row: IgdbImportRow) -> IgdbImportEntryResponse:
    entry = row.entry
    return IgdbImportEntryResponse(
        game_id=row.game.id,
        game_uuid=row.game.uuid,
        game_slug=row.game.slug,
        game_name=row.game.name,
        game_cover_url=row.game.cover_url,
        game_category=row.game.category,
        game_first_release_date=row.game.first_release_date,
        status=row.status,
        match_igdb_id=entry.match_igdb_id if entry else None,
        match_name=entry.match_name if entry else None,
        match_cover_url=entry.match_cover_url if entry else None,
        match_first_release_date=entry.match_first_release_date if entry else None,
        match_category=entry.match_category if entry else None,
        exact_match_count=entry.exact_match_count if entry else 0,
        checked_at=entry.checked_at if entry else None,
        library_game_name=row.library_game.name if row.library_game else None,
        queued=entry.queued if entry else False,
    )


class IgdbImportGameIdsRequest(CamelModel):
    game_ids: list[int] = Field(min_length=1)


class IgdbImportIgnoreRequest(IgdbImportGameIdsRequest):
    ignored: bool = True


class IgdbImportCountResponse(CamelModel):
    # How many games the request changed (ignored/un-ignored) or queued for linking.
    count: int
