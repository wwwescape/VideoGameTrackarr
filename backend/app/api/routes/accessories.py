from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.library import LibraryStatus
from app.repositories.accessory_repository import AccessoryWithStatus
from app.schemas.accessory import (
    AccessoryCreateRequest,
    AccessoryDetailResponse,
    AccessorySummaryResponse,
    AccessoryUpdateRequest,
    accessory_detail_from_orm,
    accessory_summary_from_orm,
)
from app.schemas.accessory_note import (
    AccessoryNoteCreateRequest,
    AccessoryNoteResponse,
    AccessoryNoteUpdateRequest,
    accessory_note_from_orm,
)
from app.schemas.user_accessory import (
    UserAccessoryCreateRequest,
    UserAccessoryResponse,
    UserAccessoryUpdateRequest,
    user_accessory_from_orm,
)
from app.services import accessory_note_service, accessory_service, tag_service, user_accessory_service

router = APIRouter(tags=["accessories"], dependencies=[Depends(get_current_user)])


def _accessory_detail_response(db: Session, item: AccessoryWithStatus) -> AccessoryDetailResponse:
    tags = tag_service.list_tags_for_accessory(db, item.accessory.id)
    return accessory_detail_from_orm(item, tags)


@router.get("/api/accessories", response_model=list[AccessorySummaryResponse])
def list_accessories(
    search: str | None = Query(default=None),
    manufacturer_id: int | None = Query(default=None, alias="manufacturerId"),
    accessory_type_id: int | None = Query(default=None, alias="accessoryTypeId"),
    hardware_platform_id: int | None = Query(default=None, alias="hardwarePlatformId"),
    status_filter: LibraryStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[AccessorySummaryResponse]:
    items = accessory_service.list_accessories(
        db,
        search=search,
        manufacturer_id=manufacturer_id,
        accessory_type_id=accessory_type_id,
        hardware_platform_id=hardware_platform_id,
        status=status_filter,
    )
    return [accessory_summary_from_orm(item) for item in items]


@router.get("/api/accessories/{identifier}", response_model=AccessoryDetailResponse)
def get_accessory(identifier: str, db: Session = Depends(get_db)) -> AccessoryDetailResponse:
    item = accessory_service.get_accessory_detail_by_identifier(db, identifier)
    return _accessory_detail_response(db, item)


@router.post("/api/accessories", response_model=AccessoryDetailResponse, status_code=status.HTTP_201_CREATED)
def create_accessory(body: AccessoryCreateRequest, db: Session = Depends(get_db)) -> AccessoryDetailResponse:
    item = accessory_service.create_accessory(db, **body.model_dump())
    return _accessory_detail_response(db, item)


@router.patch("/api/accessories/{accessory_id}", response_model=AccessoryDetailResponse)
def update_accessory(
    accessory_id: int, body: AccessoryUpdateRequest, db: Session = Depends(get_db)
) -> AccessoryDetailResponse:
    item = accessory_service.update_accessory(db, accessory_id, **body.model_dump(exclude_unset=True))
    return _accessory_detail_response(db, item)


@router.delete("/api/accessories/{accessory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_accessory(accessory_id: int, db: Session = Depends(get_db)) -> None:
    accessory_service.delete_accessory(db, accessory_id)


@router.get("/api/accessories/{accessory_id}/user-accessories", response_model=list[UserAccessoryResponse])
def list_user_accessories(
    accessory_id: int,
    status_filter: LibraryStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[UserAccessoryResponse]:
    items = user_accessory_service.list_user_accessories(db, accessory_id, status=status_filter)
    return [user_accessory_from_orm(item) for item in items]


@router.post(
    "/api/accessories/{accessory_id}/user-accessories",
    response_model=UserAccessoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_user_accessory(
    accessory_id: int, body: UserAccessoryCreateRequest, db: Session = Depends(get_db)
) -> UserAccessoryResponse:
    item = user_accessory_service.add_user_accessory(db, accessory_id, **body.model_dump())
    return user_accessory_from_orm(item)


@router.patch("/api/user-accessories/{item_id}", response_model=UserAccessoryResponse)
def update_user_accessory(
    item_id: int, body: UserAccessoryUpdateRequest, db: Session = Depends(get_db)
) -> UserAccessoryResponse:
    item = user_accessory_service.update_user_accessory(db, item_id, **body.model_dump(exclude_unset=True))
    return user_accessory_from_orm(item)


@router.delete("/api/user-accessories/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_accessory(item_id: int, db: Session = Depends(get_db)) -> None:
    user_accessory_service.delete_user_accessory(db, item_id)


@router.get("/api/accessories/{accessory_id}/notes", response_model=list[AccessoryNoteResponse])
def list_accessory_notes(accessory_id: int, db: Session = Depends(get_db)) -> list[AccessoryNoteResponse]:
    notes = accessory_note_service.list_notes(db, accessory_id)
    return [accessory_note_from_orm(note) for note in notes]


@router.post(
    "/api/accessories/{accessory_id}/notes", response_model=AccessoryNoteResponse, status_code=status.HTTP_201_CREATED
)
def create_accessory_note(
    accessory_id: int, body: AccessoryNoteCreateRequest, db: Session = Depends(get_db)
) -> AccessoryNoteResponse:
    note = accessory_note_service.create_note(db, accessory_id, body.body)
    return accessory_note_from_orm(note)


@router.put("/api/accessory-notes/{note_id}", response_model=AccessoryNoteResponse)
def update_accessory_note(
    note_id: int, body: AccessoryNoteUpdateRequest, db: Session = Depends(get_db)
) -> AccessoryNoteResponse:
    note = accessory_note_service.update_note(db, note_id, body.body)
    return accessory_note_from_orm(note)


@router.delete("/api/accessory-notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_accessory_note(note_id: int, db: Session = Depends(get_db)) -> None:
    accessory_note_service.delete_note(db, note_id)
