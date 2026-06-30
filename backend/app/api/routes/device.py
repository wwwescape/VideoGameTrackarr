from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.library import LibraryStatus
from app.repositories.device_repository import DeviceWithStatus
from app.schemas.device import (
    DeviceCreateRequest,
    DeviceDetailResponse,
    DeviceSummaryResponse,
    DeviceUpdateRequest,
    device_detail_from_orm,
    device_summary_from_orm,
)
from app.schemas.device_note import (
    DeviceNoteCreateRequest,
    DeviceNoteResponse,
    DeviceNoteUpdateRequest,
    device_note_from_orm,
)
from app.schemas.user_device import (
    UserDeviceCreateRequest,
    UserDeviceResponse,
    UserDeviceUpdateRequest,
    user_device_from_orm,
)
from app.services import device_note_service, device_service, tag_service, user_device_service

router = APIRouter(tags=["devices"], dependencies=[Depends(get_current_user)])


def _device_detail_response(db: Session, item: DeviceWithStatus) -> DeviceDetailResponse:
    tags = tag_service.list_tags_for_device(db, item.device.id)
    return device_detail_from_orm(item, tags)


@router.get("/api/devices", response_model=list[DeviceSummaryResponse])
def list_devices(
    search: str | None = Query(default=None),
    manufacturer_id: int | None = Query(default=None, alias="manufacturerId"),
    device_type_id: int | None = Query(default=None, alias="deviceTypeId"),
    hardware_platform_id: int | None = Query(default=None, alias="hardwarePlatformId"),
    status_filter: LibraryStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[DeviceSummaryResponse]:
    items = device_service.list_devices(
        db,
        search=search,
        manufacturer_id=manufacturer_id,
        device_type_id=device_type_id,
        hardware_platform_id=hardware_platform_id,
        status=status_filter,
    )
    return [device_summary_from_orm(item) for item in items]


@router.get("/api/devices/{identifier}", response_model=DeviceDetailResponse)
def get_device(identifier: str, db: Session = Depends(get_db)) -> DeviceDetailResponse:
    item = device_service.get_device_detail_by_identifier(db, identifier)
    return _device_detail_response(db, item)


@router.post("/api/devices", response_model=DeviceDetailResponse, status_code=status.HTTP_201_CREATED)
def create_device(body: DeviceCreateRequest, db: Session = Depends(get_db)) -> DeviceDetailResponse:
    item = device_service.create_device(db, **body.model_dump())
    return _device_detail_response(db, item)


@router.patch("/api/devices/{device_id}", response_model=DeviceDetailResponse)
def update_device(
    device_id: int, body: DeviceUpdateRequest, db: Session = Depends(get_db)
) -> DeviceDetailResponse:
    item = device_service.update_device(db, device_id, **body.model_dump(exclude_unset=True))
    return _device_detail_response(db, item)


@router.delete("/api/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(device_id: int, db: Session = Depends(get_db)) -> None:
    device_service.delete_device(db, device_id)


@router.get("/api/devices/{device_id}/user-devices", response_model=list[UserDeviceResponse])
def list_user_devices(
    device_id: int,
    status_filter: LibraryStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[UserDeviceResponse]:
    items = user_device_service.list_user_devices(db, device_id, status=status_filter)
    return [user_device_from_orm(item) for item in items]


@router.post(
    "/api/devices/{device_id}/user-devices",
    response_model=UserDeviceResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_user_device(
    device_id: int, body: UserDeviceCreateRequest, db: Session = Depends(get_db)
) -> UserDeviceResponse:
    item = user_device_service.add_user_device(db, device_id, **body.model_dump())
    return user_device_from_orm(item)


@router.patch("/api/user-devices/{item_id}", response_model=UserDeviceResponse)
def update_user_device(
    item_id: int, body: UserDeviceUpdateRequest, db: Session = Depends(get_db)
) -> UserDeviceResponse:
    item = user_device_service.update_user_device(db, item_id, **body.model_dump(exclude_unset=True))
    return user_device_from_orm(item)


@router.delete("/api/user-devices/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_device(item_id: int, db: Session = Depends(get_db)) -> None:
    user_device_service.delete_user_device(db, item_id)


@router.get("/api/devices/{device_id}/notes", response_model=list[DeviceNoteResponse])
def list_device_notes(device_id: int, db: Session = Depends(get_db)) -> list[DeviceNoteResponse]:
    notes = device_note_service.list_notes(db, device_id)
    return [device_note_from_orm(note) for note in notes]


@router.post("/api/devices/{device_id}/notes", response_model=DeviceNoteResponse, status_code=status.HTTP_201_CREATED)
def create_device_note(
    device_id: int, body: DeviceNoteCreateRequest, db: Session = Depends(get_db)
) -> DeviceNoteResponse:
    note = device_note_service.create_note(db, device_id, body.body)
    return device_note_from_orm(note)


@router.put("/api/device-notes/{note_id}", response_model=DeviceNoteResponse)
def update_device_note(
    note_id: int, body: DeviceNoteUpdateRequest, db: Session = Depends(get_db)
) -> DeviceNoteResponse:
    note = device_note_service.update_note(db, note_id, body.body)
    return device_note_from_orm(note)


@router.delete("/api/device-notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device_note(note_id: int, db: Session = Depends(get_db)) -> None:
    device_note_service.delete_note(db, note_id)
