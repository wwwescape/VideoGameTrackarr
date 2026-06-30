from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.library import LibraryStatus
from app.schemas.library import (
    LibraryItemCreateRequest,
    LibraryItemResponse,
    LibraryItemUpdateRequest,
    library_item_from_orm,
)
from app.services import library_service

router = APIRouter(tags=["library"], dependencies=[Depends(get_current_user)])


@router.get("/api/games/{game_id}/library", response_model=list[LibraryItemResponse])
def list_library_items(
    game_id: int,
    status_filter: LibraryStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[LibraryItemResponse]:
    items = library_service.list_library_items(db, game_id, status=status_filter)
    return [library_item_from_orm(item) for item in items]


@router.post(
    "/api/games/{game_id}/library", response_model=LibraryItemResponse, status_code=status.HTTP_201_CREATED
)
def add_library_item(
    game_id: int, body: LibraryItemCreateRequest, db: Session = Depends(get_db)
) -> LibraryItemResponse:
    item = library_service.add_library_item(db, game_id, **body.model_dump())
    return library_item_from_orm(item)


@router.put("/api/library/{item_id}", response_model=LibraryItemResponse)
def update_library_item(
    item_id: int, body: LibraryItemUpdateRequest, db: Session = Depends(get_db)
) -> LibraryItemResponse:
    item = library_service.update_library_item(db, item_id, **body.model_dump(exclude_unset=True))
    return library_item_from_orm(item)


@router.delete("/api/library/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_library_item(item_id: int, db: Session = Depends(get_db)) -> None:
    library_service.delete_library_item(db, item_id)
