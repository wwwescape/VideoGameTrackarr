from datetime import datetime
from typing import Literal

from pydantic import Field

from app.models.catalog import Game
from app.models.library import LibraryStatus
from app.models.toys_to_life import ToysToLifeCopy, ToysToLifeItem, ToysToLifeNote
from app.schemas.base import CamelModel
from app.schemas.tag import TagResponse
from app.services.toys_to_life_image_service import resolve_image_url
from app.services.toys_to_life_lines import ToysToLifeLine


class ToysToLifeParentGame(CamelModel):
    """The game a line's packs extend. `slug`/`uuid` are set only when it's in your library,
    so the "Toy to Life of" chip can link to its game page (and fall back to IGDB otherwise)."""

    name: str
    igdb_id: int
    slug: str | None
    uuid: str | None
    cover_url: str | None


class ToysToLifeLineResponse(CamelModel):
    slug: str
    name: str
    parent_game: ToysToLifeParentGame
    pack_count: int
    owned_count: int
    wishlist_count: int


class ToysToLifeItemSummary(CamelModel):
    id: int
    uuid: str
    line: str
    set_number: str
    name: str
    pack_type: str
    franchise: str | None
    minifigures: str | None
    platform_name: str | None
    platform_igdb_id: int | None
    igdb_id: int | None
    image_url: str | None
    # Like a game: both are true when you own one copy and want another.
    owned: bool
    wishlisted: bool
    rating: int | None


class ToysToLifeGameSection(CamelModel):
    """A line's packs for its game's page (starter kits only for the platforms you own it on)."""

    line: str
    line_name: str
    items: list[ToysToLifeItemSummary]


class ToysToLifeReleaseDate(CamelModel):
    region: Literal["north_america", "europe", "worldwide"]
    # ISO date, or just a year when that's all that's known.
    date: str


class ToysToLifeCopyResponse(CamelModel):
    id: int
    status: LibraryStatus
    price: float | None
    notes: str | None


def copy_from_orm(copy: ToysToLifeCopy) -> ToysToLifeCopyResponse:
    return ToysToLifeCopyResponse(id=copy.id, status=copy.status, price=copy.price, notes=copy.notes)


class ToysToLifeItemDetail(ToysToLifeItemSummary):
    # Your copies, owned and wishlisted (the pack's own status follows from them).
    copies: list[ToysToLifeCopyResponse]
    summary: str | None
    igdb_url: str | None
    release_dates: list[ToysToLifeReleaseDate]
    line_name: str
    parent_game: ToysToLifeParentGame
    tags: list[TagResponse]


def parent_game_from(line: ToysToLifeLine, game: Game | None) -> ToysToLifeParentGame:
    return ToysToLifeParentGame(
        name=game.name if game else line.name,
        igdb_id=line.parent_igdb_id,
        slug=game.slug if game else None,
        uuid=game.uuid if game else None,
        cover_url=game.cover_url if game else None,
    )


def _summary_fields(item: ToysToLifeItem) -> dict:
    return {
        "id": item.id,
        "uuid": item.uuid,
        "line": item.line,
        "set_number": item.set_number,
        "name": item.name,
        "pack_type": item.pack_type,
        "franchise": item.franchise,
        "minifigures": item.minifigures,
        "platform_name": item.platform_name,
        "platform_igdb_id": item.platform_igdb_id,
        "igdb_id": item.igdb_id,
        "image_url": resolve_image_url(item),
        "owned": item.owned,
        "wishlisted": item.wishlisted,
        "rating": item.user_rating,
    }


def item_summary_from_orm(item: ToysToLifeItem) -> ToysToLifeItemSummary:
    return ToysToLifeItemSummary(**_summary_fields(item))


def item_detail_from_orm(
    item: ToysToLifeItem, line: ToysToLifeLine, parent: Game | None, tags: list[TagResponse]
) -> ToysToLifeItemDetail:
    release_dates = [
        ToysToLifeReleaseDate(region=region, date=value)
        for region, value in (
            ("north_america", item.release_date_na),
            ("europe", item.release_date_eu),
            ("worldwide", item.release_date_ww),
        )
        if value
    ]
    return ToysToLifeItemDetail(
        **_summary_fields(item),
        copies=[copy_from_orm(copy) for copy in item.copies],
        summary=item.summary,
        igdb_url=item.igdb_url,
        release_dates=release_dates,
        line_name=line.name,
        parent_game=parent_game_from(line, parent),
        tags=tags,
    )


class ToysToLifeCopyCreateRequest(CamelModel):
    status: LibraryStatus
    price: float | None = Field(default=None, ge=0)
    notes: str | None = None


class ToysToLifeCopyUpdateRequest(CamelModel):
    """Only the fields sent change (Move to Wishlist sends just the status)."""

    status: LibraryStatus | None = None
    price: float | None = Field(default=None, ge=0)
    notes: str | None = None


class ToysToLifeRatingRequest(CamelModel):
    # 1-10 stars; null clears it.
    rating: int | None = Field(default=None, ge=1, le=10)


class ToysToLifeRatingResponse(CamelModel):
    rating: int | None


class ToysToLifeNoteResponse(CamelModel):
    id: int
    item_id: int
    body: str
    created_at: datetime
    updated_at: datetime


def note_from_orm(note: ToysToLifeNote) -> ToysToLifeNoteResponse:
    return ToysToLifeNoteResponse(
        id=note.id, item_id=note.item_id, body=note.body, created_at=note.created_at, updated_at=note.updated_at
    )


class ToysToLifeNoteCreateRequest(CamelModel):
    body: str = Field(min_length=1)


class ToysToLifeNoteUpdateRequest(CamelModel):
    body: str = Field(min_length=1)
