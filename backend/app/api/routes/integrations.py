from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.system import User
from app.schemas.integrations import (
    IntegrationsStatusResponse,
    SteamEntryResponse,
    SteamStoreDetailsResponse,
    SyncResultResponse,
    SyncSteamEntriesRequest,
    UpdateSteamIdRequest,
)
from app.services import integrations_service, steam_service
from app.services.exceptions import NotFoundError
from app.services.steam_store_client import SteamStoreClient

router = APIRouter(tags=["integrations"], dependencies=[Depends(get_current_user)])


@router.get("/api/integrations", response_model=IntegrationsStatusResponse)
def get_integrations_status(current_user: User = Depends(get_current_user)) -> IntegrationsStatusResponse:
    return integrations_service.get_status(current_user)


@router.put("/api/integrations/steam", response_model=IntegrationsStatusResponse)
def update_steam_id(
    payload: UpdateSteamIdRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IntegrationsStatusResponse:
    updated_user = integrations_service.set_steam_id(db, current_user, payload.steam_id_64)
    return integrations_service.get_status(updated_user)


@router.get("/api/integrations/steam/entries", response_model=list[SteamEntryResponse])
def get_steam_entries(db: Session = Depends(get_db)) -> list[SteamEntryResponse]:
    return [_entry_response(item) for item in steam_service.list_entries(db)]


@router.post("/api/integrations/steam/sync", response_model=SyncResultResponse)
def sync_steam_entries(payload: SyncSteamEntriesRequest, db: Session = Depends(get_db)) -> SyncResultResponse:
    return SyncResultResponse.model_validate(steam_service.sync_entries(db, payload.steam_app_ids))


@router.post("/api/integrations/steam/{steam_app_id}/ignore", response_model=SteamEntryResponse)
def ignore_steam_entry(steam_app_id: int, db: Session = Depends(get_db)) -> SteamEntryResponse:
    return _entry_response(steam_service.ignore_entry(db, steam_app_id))


@router.get("/api/integrations/steam/{steam_app_id}/store-details", response_model=SteamStoreDetailsResponse)
async def get_steam_store_details(steam_app_id: int) -> SteamStoreDetailsResponse:
    async with SteamStoreClient() as client:
        details = await client.get_app_details(steam_app_id)
    if details is None:
        raise NotFoundError(f"No Steam store page found for app {steam_app_id}")
    return SteamStoreDetailsResponse(name=details.name, summary=details.summary, cover_url=details.cover_url)


def _entry_response(item: "steam_service.SteamEntryWithStatus") -> SteamEntryResponse:
    entry = item.entry
    game = entry.game
    return SteamEntryResponse(
        steam_app_id=entry.steam_app_id,
        steam_name=entry.steam_name,
        steam_playtime_minutes=entry.steam_playtime_minutes,
        steam_last_played_at=entry.steam_last_played_at,
        status=item.status.value,
        game_id=game.id if game else None,
        game_name=game.name if game else None,
        game_slug=game.slug if game else None,
        game_cover_url=game.cover_url if game else None,
        vgt_playtime_minutes=item.vgt_playtime_minutes,
    )
