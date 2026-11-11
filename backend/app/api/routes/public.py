from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.repositories.game_repository import PRIVATE_SORTS, GameSortOption
from app.schemas.labs import PublicLabsResponse
from app.schemas.public import (
    PublicAccessorySummaryResponse,
    PublicDeviceSummaryResponse,
    PublicGameDetailResponse,
    PublicGameSummaryResponse,
    public_accessory_from_orm,
    public_device_from_orm,
    public_game_detail_from_orm,
    public_game_from_orm,
)
from app.schemas.shelf import PublicGameShelfResponse, public_game_shelf_response
from app.services import accessory_service, auth_service, device_service, game_service, game_shelf_service, labs
from app.services.labs import LAB_GAME_SHELF, require_lab

# No auth dependency — this is the app's one deliberately unauthenticated router, gated
# instead by the unlisted per-user token in the path. See auth_service.get_user_by_share_token.
router = APIRouter(prefix="/api/public/{token}", tags=["public"])


@router.get("/games", response_model=list[PublicGameSummaryResponse])
def list_public_games(
    token: str,
    search: str | None = Query(default=None),
    sort: GameSortOption = Query(default=GameSortOption.NAME_ASC),
    db: Session = Depends(get_db),
) -> list[PublicGameSummaryResponse]:
    auth_service.get_user_by_share_token(db, token)
    # The share page doesn't show copies, progress, ratings or sales, so it can't sort by them.
    if sort in PRIVATE_SORTS:
        sort = GameSortOption.NAME_ASC
    games = game_service.search_local_games(db, search=search, sort=sort)
    return [public_game_from_orm(game) for game in games]


@router.get("/labs", response_model=PublicLabsResponse)
def list_public_labs(token: str, db: Session = Depends(get_db)) -> PublicLabsResponse:
    """The labs that are on, so the share page shows their tabs (the Game Shelf's)."""
    auth_service.get_user_by_share_token(db, token)
    return PublicLabsResponse(enabled=labs.enabled_ids(db))


@router.get("/shelf", response_model=PublicGameShelfResponse, dependencies=[Depends(require_lab(LAB_GAME_SHELF))])
def get_public_shelf(
    token: str,
    search: str | None = Query(default=None),
    sort: GameSortOption = Query(default=GameSortOption.NAME_ASC),
    db: Session = Depends(get_db),
) -> PublicGameShelfResponse:
    """The share page's Game Shelf: search and the public sorts, no filters (like its Games tab)."""
    auth_service.get_user_by_share_token(db, token)
    if sort in PRIVATE_SORTS:
        sort = GameSortOption.NAME_ASC
    return public_game_shelf_response(game_shelf_service.build_shelf(db, search=search, sort=sort))


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
