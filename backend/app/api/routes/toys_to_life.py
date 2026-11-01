from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.library import LibraryStatus
from app.schemas.tag import tag_from_orm
from app.schemas.toys_to_life import (
    ToysToLifeCopyCreateRequest,
    ToysToLifeCopyResponse,
    ToysToLifeCopyUpdateRequest,
    ToysToLifeGameSection,
    ToysToLifeItemDetail,
    ToysToLifeItemSummary,
    ToysToLifeLineResponse,
    ToysToLifeNoteCreateRequest,
    ToysToLifeNoteResponse,
    ToysToLifeNoteUpdateRequest,
    ToysToLifeRatingRequest,
    ToysToLifeRatingResponse,
    copy_from_orm,
    item_detail_from_orm,
    item_summary_from_orm,
    note_from_orm,
    parent_game_from,
)
from app.services import toys_to_life_service

router = APIRouter(prefix="/api/toys-to-life", tags=["toys-to-life"], dependencies=[Depends(get_current_user)])


@router.get("/lines", response_model=list[ToysToLifeLineResponse])
def list_lines(db: Session = Depends(get_db)) -> list[ToysToLifeLineResponse]:
    return [
        ToysToLifeLineResponse(
            slug=line.slug,
            name=line.name,
            parent_game=parent_game_from(line, game),
            pack_count=packs,
            owned_count=owned,
            wishlist_count=wishlist,
        )
        for line, game, (packs, owned, wishlist) in toys_to_life_service.list_lines(db)
    ]


@router.get("/lines/{line}/items", response_model=list[ToysToLifeItemSummary])
def list_items(
    line: str,
    search: str | None = Query(default=None),
    pack_types: list[str] | None = Query(default=None, alias="packType"),
    status_filter: LibraryStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[ToysToLifeItemSummary]:
    items = toys_to_life_service.list_items(db, line, search=search, pack_types=pack_types, status=status_filter)
    return [item_summary_from_orm(item) for item in items]


@router.get("/lines/{line}/items/{set_number}", response_model=ToysToLifeItemDetail)
def get_item(line: str, set_number: str, db: Session = Depends(get_db)) -> ToysToLifeItemDetail:
    item, toy_line, parent, tags = toys_to_life_service.get_item_detail(db, line, set_number)
    return item_detail_from_orm(item, toy_line, parent, [tag_from_orm(tag) for tag in tags])


@router.get("/games/{game_id}", response_model=ToysToLifeGameSection | None)
def get_game_section(game_id: int, db: Session = Depends(get_db)) -> ToysToLifeGameSection | None:
    """The game page's Toys to Life section; null for a game that isn't a line's base game."""
    section = toys_to_life_service.get_game_section(db, game_id)
    if section is None:
        return None
    line, items = section
    return ToysToLifeGameSection(
        line=line.slug, line_name=line.name, items=[item_summary_from_orm(item) for item in items]
    )


@router.post("/items/{item_id}/copies", response_model=ToysToLifeCopyResponse, status_code=status.HTTP_201_CREATED)
def create_copy(
    item_id: int, body: ToysToLifeCopyCreateRequest, db: Session = Depends(get_db)
) -> ToysToLifeCopyResponse:
    return copy_from_orm(toys_to_life_service.create_copy(db, item_id, body.status, body.price, body.notes))


@router.put("/copies/{copy_id}", response_model=ToysToLifeCopyResponse)
def update_copy(
    copy_id: int, body: ToysToLifeCopyUpdateRequest, db: Session = Depends(get_db)
) -> ToysToLifeCopyResponse:
    return copy_from_orm(toys_to_life_service.update_copy(db, copy_id, body.model_dump(exclude_unset=True)))


@router.delete("/copies/{copy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_copy(copy_id: int, db: Session = Depends(get_db)) -> None:
    toys_to_life_service.delete_copy(db, copy_id)


@router.put("/items/{item_id}/rating", response_model=ToysToLifeRatingResponse)
def set_rating(item_id: int, body: ToysToLifeRatingRequest, db: Session = Depends(get_db)) -> ToysToLifeRatingResponse:
    return ToysToLifeRatingResponse(rating=toys_to_life_service.set_user_rating(db, item_id, body.rating))


@router.get("/items/{item_id}/notes", response_model=list[ToysToLifeNoteResponse])
def list_notes(item_id: int, db: Session = Depends(get_db)) -> list[ToysToLifeNoteResponse]:
    return [note_from_orm(note) for note in toys_to_life_service.list_notes(db, item_id)]


@router.post("/items/{item_id}/notes", response_model=ToysToLifeNoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(
    item_id: int, body: ToysToLifeNoteCreateRequest, db: Session = Depends(get_db)
) -> ToysToLifeNoteResponse:
    return note_from_orm(toys_to_life_service.create_note(db, item_id, body.body))


@router.put("/notes/{note_id}", response_model=ToysToLifeNoteResponse)
def update_note(
    note_id: int, body: ToysToLifeNoteUpdateRequest, db: Session = Depends(get_db)
) -> ToysToLifeNoteResponse:
    return note_from_orm(toys_to_life_service.update_note(db, note_id, body.body))


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, db: Session = Depends(get_db)) -> None:
    toys_to_life_service.delete_note(db, note_id)
