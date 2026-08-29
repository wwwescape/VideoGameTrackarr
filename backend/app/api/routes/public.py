from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.public import (
    PublicAccessorySummaryResponse,
    PublicDeviceSummaryResponse,
    PublicGameSummaryResponse,
    public_accessory_from_orm,
    public_device_from_orm,
    public_game_from_orm,
)
from app.services import accessory_service, auth_service, device_service, game_service

# No auth dependency — this is the app's one deliberately unauthenticated router, gated
# instead by the unlisted per-user token in the path. See auth_service.get_user_by_share_token.
router = APIRouter(prefix="/api/public/{token}", tags=["public"])


@router.get("/games", response_model=list[PublicGameSummaryResponse])
def list_public_games(
    token: str, search: str | None = Query(default=None), db: Session = Depends(get_db)
) -> list[PublicGameSummaryResponse]:
    auth_service.get_user_by_share_token(db, token)
    games = game_service.search_local_games(db, search=search)
    return [public_game_from_orm(game) for game in games]


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
