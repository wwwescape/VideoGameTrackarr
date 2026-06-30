from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.tag import TagCreateRequest, TagResponse, tag_from_orm
from app.services import tag_service

router = APIRouter(tags=["tags"], dependencies=[Depends(get_current_user)])


@router.get("/api/tags", response_model=list[TagResponse])
def list_tags(db: Session = Depends(get_db)) -> list[TagResponse]:
    return [tag_from_orm(tag) for tag in tag_service.list_tags(db)]


@router.post("/api/tags", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
def create_tag(body: TagCreateRequest, db: Session = Depends(get_db)) -> TagResponse:
    tag = tag_service.create_tag(db, body.name, body.color)
    return tag_from_orm(tag)


@router.delete("/api/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(tag_id: int, db: Session = Depends(get_db)) -> None:
    tag_service.delete_tag(db, tag_id)


@router.post("/api/games/{game_id}/tags/{tag_id}", response_model=list[TagResponse])
def attach_tag(game_id: int, tag_id: int, db: Session = Depends(get_db)) -> list[TagResponse]:
    tags = tag_service.attach_tag(db, game_id, tag_id)
    return [tag_from_orm(tag) for tag in tags]


@router.delete("/api/games/{game_id}/tags/{tag_id}", response_model=list[TagResponse])
def detach_tag(game_id: int, tag_id: int, db: Session = Depends(get_db)) -> list[TagResponse]:
    tags = tag_service.detach_tag(db, game_id, tag_id)
    return [tag_from_orm(tag) for tag in tags]


@router.post("/api/devices/{device_id}/tags/{tag_id}", response_model=list[TagResponse])
def attach_tag_to_device(device_id: int, tag_id: int, db: Session = Depends(get_db)) -> list[TagResponse]:
    tags = tag_service.attach_tag_to_device(db, device_id, tag_id)
    return [tag_from_orm(tag) for tag in tags]


@router.delete("/api/devices/{device_id}/tags/{tag_id}", response_model=list[TagResponse])
def detach_tag_from_device(device_id: int, tag_id: int, db: Session = Depends(get_db)) -> list[TagResponse]:
    tags = tag_service.detach_tag_from_device(db, device_id, tag_id)
    return [tag_from_orm(tag) for tag in tags]


@router.post("/api/accessories/{accessory_id}/tags/{tag_id}", response_model=list[TagResponse])
def attach_tag_to_accessory(accessory_id: int, tag_id: int, db: Session = Depends(get_db)) -> list[TagResponse]:
    tags = tag_service.attach_tag_to_accessory(db, accessory_id, tag_id)
    return [tag_from_orm(tag) for tag in tags]


@router.delete("/api/accessories/{accessory_id}/tags/{tag_id}", response_model=list[TagResponse])
def detach_tag_from_accessory(accessory_id: int, tag_id: int, db: Session = Depends(get_db)) -> list[TagResponse]:
    tags = tag_service.detach_tag_from_accessory(db, accessory_id, tag_id)
    return [tag_from_orm(tag) for tag in tags]
