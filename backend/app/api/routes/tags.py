from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.tag import (
    TagCoverageResponse,
    TagCreateRequest,
    TagResponse,
    TagUpdateRequest,
    tag_coverage_from_orm,
    tag_from_orm,
)
from app.services import tag_service

router = APIRouter(tags=["tags"], dependencies=[Depends(get_current_user)])


@router.get("/api/tags", response_model=list[TagResponse])
def list_tags(db: Session = Depends(get_db)) -> list[TagResponse]:
    return [tag_from_orm(tag) for tag in tag_service.list_tags(db)]


# Powers the Games page's bulk "Manage Tags" dialog — every tag in the library paired with
# how many of the given games currently have it, so the dialog can show "X of N games"
# without GameSummary (what the Games list already has in the browser) needing to carry
# full tag data for every visible card just for this one bulk-action dialog.
@router.get("/api/tags/coverage", response_model=list[TagCoverageResponse])
def get_tag_coverage(
    game_id: list[int] = Query(default=[], alias="gameId"), db: Session = Depends(get_db)
) -> list[TagCoverageResponse]:
    coverage = tag_service.get_tag_coverage_for_games(db, game_id)
    return [tag_coverage_from_orm(tag, matched_game_ids) for tag, matched_game_ids in coverage]


@router.post("/api/tags", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
def create_tag(body: TagCreateRequest, db: Session = Depends(get_db)) -> TagResponse:
    tag = tag_service.create_tag(db, body.name, body.color, body.text_color)
    return tag_from_orm(tag)


@router.patch("/api/tags/{tag_id}", response_model=TagResponse)
def update_tag(tag_id: int, body: TagUpdateRequest, db: Session = Depends(get_db)) -> TagResponse:
    tag = tag_service.update_tag(db, tag_id, body.name, body.color, body.text_color)
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
