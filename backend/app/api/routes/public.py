from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.repositories.game_repository import GameSortOption
from app.schemas.game import BookshelfEntryResponse
from app.schemas.public import (
    PublicAccessorySummaryResponse,
    PublicBookshelfPlatformResponse,
    PublicBookshelfResponse,
    PublicDeviceSummaryResponse,
    PublicGameDetailResponse,
    PublicGameSummaryResponse,
    public_accessory_from_orm,
    public_device_from_orm,
    public_game_detail_from_orm,
    public_game_from_orm,
)
from app.services import accessory_service, auth_service, device_service, game_service

# No auth dependency — this is the app's one deliberately unauthenticated router, gated
# instead by the unlisted per-user token in the path. See auth_service.get_user_by_share_token.
router = APIRouter(prefix="/api/public/{token}", tags=["public"])


@router.get("/bookshelf", response_model=PublicBookshelfResponse)
def get_public_bookshelf(
    token: str,
    db: Session = Depends(get_db),
) -> PublicBookshelfResponse:
    auth_service.get_user_by_share_token(db, token)
    entries = game_service.list_bookshelf_entries(db)
    # The shelf's platform display records (template art, case size, spine
    # styling) for just the platforms that have cases on it.
    from app.models.catalog import Platform

    labels = {entry.platform_label for entry in entries}
    platforms = [
        PublicBookshelfPlatformResponse(
            label=platform.abbreviation or platform.name,
            name=platform.name,
            abbreviation=platform.abbreviation,
            spine_template_url=platform.spine_template_url,
            case_height_mm=platform.case_height_mm,
            case_spine_mm=platform.case_spine_mm,
            spine_color=platform.spine_color,
            spine_icon=platform.spine_icon,
            spine_icon_url=platform.spine_icon_url,
        )
        for platform in db.query(Platform).all()
        if (platform.abbreviation or platform.name) in labels
    ]
    return PublicBookshelfResponse(
        entries=[
            BookshelfEntryResponse(
                game_id=entry.game_id,
                game_slug=entry.game_slug,
                game_uuid=entry.game_uuid,
                name=entry.name,
                platform_label=entry.platform_label,
                formats=entry.formats,
            )
            for entry in entries
        ],
        platforms=platforms,
    )


@router.get("/games", response_model=list[PublicGameSummaryResponse])
def list_public_games(
    token: str,
    search: str | None = Query(default=None),
    sort: GameSortOption = Query(default=GameSortOption.NAME_ASC),
    db: Session = Depends(get_db),
) -> list[PublicGameSummaryResponse]:
    auth_service.get_user_by_share_token(db, token)
    games = game_service.search_local_games(db, search=search, sort=sort)
    return [public_game_from_orm(game) for game in games]


@router.get("/games/{game_id}", response_model=PublicGameDetailResponse)
def get_public_game(token: str, game_id: int, db: Session = Depends(get_db)) -> PublicGameDetailResponse:
    auth_service.get_user_by_share_token(db, token)
    return public_game_detail_from_orm(game_service.get_public_game_detail(db, game_id))


@router.get("/devices", response_model=list[PublicDeviceSummaryResponse])
def list_public_devices(
    token: str, search: str | None = Query(default=None), db: Session = Depends(get_db)
) -> list[PublicDeviceSummaryResponse]:
    auth_service.get_user_by_share_token(db, token)
    devices = device_service.list_devices(db, search=search)
    return [public_device_from_orm(device) for device in devices]


@router.get("/accessories", response_model=list[PublicAccessorySummaryResponse])
def list_public_accessories(
    token: str, search: str | None = Query(default=None), db: Session = Depends(get_db)
) -> list[PublicAccessorySummaryResponse]:
    auth_service.get_user_by_share_token(db, token)
    accessories = accessory_service.list_accessories(db, search=search)
    return [public_accessory_from_orm(accessory) for accessory in accessories]
