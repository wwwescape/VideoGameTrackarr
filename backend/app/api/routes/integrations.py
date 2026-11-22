from collections.abc import Callable
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_session_factory
from app.core.security import TokenError, TokenType, create_gog_installer_token, decode_token
from app.models.gog import GogDownload
from app.models.system import User
from app.schemas.integrations import (
    GogConnectRequest,
    GogDownloadResponse,
    GogDownloadsResponse,
    GogEntryResponse,
    GogFileLinkResponse,
    GogIgnoreResultResponse,
    GogInstallersResponse,
    GogQueueInstallerRequest,
    GogStatusResponse,
    GogStoreDetailsResponse,
    GogSyncResultResponse,
    IgnoreResultResponse,
    IntegrationsStatusResponse,
    RelinkSteamEntryRequest,
    SteamEntryResponse,
    SteamStoreDetailsResponse,
    SteamWishlistEntryResponse,
    SyncGogEntriesRequest,
    SyncResultResponse,
    SyncSteamEntriesRequest,
    UpdateSteamIdRequest,
)
from app.services import (
    gog_download_service,
    gog_jobs,
    gog_service,
    gog_wishlist_service,
    integrations_service,
    steam_service,
    steam_wishlist_service,
)
from app.services.exceptions import NotFoundError
from app.services.gog_client import GogAuthError, GogClient
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


# Both bulk Ignore routes sit above every /steam/{steam_app_id}/... route: declared after
# them, "/steam/wishlist/ignore" would match "/steam/{steam_app_id}/ignore" first and fail
# with a 422 on "wishlist".
@router.post("/api/integrations/steam/ignore", response_model=IgnoreResultResponse)
def ignore_steam_entries(payload: SyncSteamEntriesRequest, db: Session = Depends(get_db)) -> IgnoreResultResponse:
    return IgnoreResultResponse.model_validate(steam_service.ignore_entries(db, payload.steam_app_ids))


@router.post("/api/integrations/steam/wishlist/ignore", response_model=IgnoreResultResponse)
def ignore_steam_wishlist_entries(
    payload: SyncSteamEntriesRequest, db: Session = Depends(get_db)
) -> IgnoreResultResponse:
    return IgnoreResultResponse.model_validate(steam_wishlist_service.ignore_entries(db, payload.steam_app_ids))


@router.post("/api/integrations/steam/{steam_app_id}/ignore", response_model=SteamEntryResponse)
def ignore_steam_entry(steam_app_id: int, db: Session = Depends(get_db)) -> SteamEntryResponse:
    return _entry_response(steam_service.ignore_entry(db, steam_app_id))


@router.post("/api/integrations/steam/{steam_app_id}/unignore", response_model=SteamEntryResponse)
def unignore_steam_entry(steam_app_id: int, db: Session = Depends(get_db)) -> SteamEntryResponse:
    return _entry_response(steam_service.unignore_entry(db, steam_app_id))


@router.post("/api/integrations/steam/{steam_app_id}/relink", response_model=SteamEntryResponse)
def relink_steam_entry(
    steam_app_id: int, payload: RelinkSteamEntryRequest, db: Session = Depends(get_db)
) -> SteamEntryResponse:
    return _entry_response(steam_service.relink_entry(db, steam_app_id, payload.game_id))


@router.post("/api/integrations/steam/{steam_app_id}/unlink", response_model=SteamEntryResponse)
def unlink_steam_entry(steam_app_id: int, db: Session = Depends(get_db)) -> SteamEntryResponse:
    return _entry_response(steam_service.unlink_entry(db, steam_app_id))


@router.get("/api/integrations/steam/{steam_app_id}/store-details", response_model=SteamStoreDetailsResponse)
async def get_steam_store_details(steam_app_id: int) -> SteamStoreDetailsResponse:
    async with SteamStoreClient() as client:
        details = await client.get_app_details(steam_app_id)
    if details is None:
        raise NotFoundError(f"No Steam store page found for app {steam_app_id}")
    return SteamStoreDetailsResponse(name=details.name, summary=details.summary, cover_url=details.cover_url)


@router.get("/api/integrations/steam/wishlist/entries", response_model=list[SteamWishlistEntryResponse])
def get_steam_wishlist_entries(db: Session = Depends(get_db)) -> list[SteamWishlistEntryResponse]:
    return [_wishlist_entry_response(item) for item in steam_wishlist_service.list_entries(db)]


@router.post("/api/integrations/steam/wishlist/sync", response_model=SyncResultResponse)
def sync_steam_wishlist_entries(
    payload: SyncSteamEntriesRequest, db: Session = Depends(get_db)
) -> SyncResultResponse:
    return SyncResultResponse.model_validate(steam_wishlist_service.sync_entries(db, payload.steam_app_ids))


@router.post(
    "/api/integrations/steam/wishlist/{steam_app_id}/ignore", response_model=SteamWishlistEntryResponse
)
def ignore_steam_wishlist_entry(steam_app_id: int, db: Session = Depends(get_db)) -> SteamWishlistEntryResponse:
    return _wishlist_entry_response(steam_wishlist_service.ignore_entry(db, steam_app_id))


@router.post(
    "/api/integrations/steam/wishlist/{steam_app_id}/unignore", response_model=SteamWishlistEntryResponse
)
def unignore_steam_wishlist_entry(steam_app_id: int, db: Session = Depends(get_db)) -> SteamWishlistEntryResponse:
    return _wishlist_entry_response(steam_wishlist_service.unignore_entry(db, steam_app_id))


@router.post(
    "/api/integrations/steam/wishlist/{steam_app_id}/relink", response_model=SteamWishlistEntryResponse
)
def relink_steam_wishlist_entry(
    steam_app_id: int, payload: RelinkSteamEntryRequest, db: Session = Depends(get_db)
) -> SteamWishlistEntryResponse:
    return _wishlist_entry_response(steam_wishlist_service.relink_entry(db, steam_app_id, payload.game_id))


@router.post(
    "/api/integrations/steam/wishlist/{steam_app_id}/unlink", response_model=SteamWishlistEntryResponse
)
def unlink_steam_wishlist_entry(steam_app_id: int, db: Session = Depends(get_db)) -> SteamWishlistEntryResponse:
    return _wishlist_entry_response(steam_wishlist_service.unlink_entry(db, steam_app_id))


@router.get("/api/integrations/gog", response_model=GogStatusResponse)
def get_gog_status(current_user: User = Depends(get_current_user)) -> GogStatusResponse:
    return GogStatusResponse.model_validate(gog_service.get_status(current_user))


@router.post("/api/integrations/gog/connect", response_model=GogStatusResponse)
async def connect_gog(
    payload: GogConnectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GogStatusResponse:
    # A bad or expired sign-in is something the user fixes by signing in again: a 422,
    # not a server error.
    try:
        updated_user = await gog_service.connect(db, current_user, payload.redirect_url)
    except GogAuthError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return GogStatusResponse.model_validate(gog_service.get_status(updated_user))


@router.post("/api/integrations/gog/disconnect", response_model=GogStatusResponse)
def disconnect_gog(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> GogStatusResponse:
    return GogStatusResponse.model_validate(gog_service.get_status(gog_service.disconnect(db, current_user)))


@router.get("/api/integrations/gog/entries", response_model=list[GogEntryResponse])
def get_gog_entries(db: Session = Depends(get_db)) -> list[GogEntryResponse]:
    return [_gog_entry_response(item) for item in gog_service.list_entries(db)]


@router.post("/api/integrations/gog/sync", response_model=GogSyncResultResponse)
def sync_gog_entries(payload: SyncGogEntriesRequest, db: Session = Depends(get_db)) -> GogSyncResultResponse:
    return GogSyncResultResponse.model_validate(gog_service.sync_entries(db, payload.gog_product_ids))


# Above every /gog/{gog_product_id}/... route, for the same reason as the Steam bulk Ignore.
@router.post("/api/integrations/gog/ignore", response_model=GogIgnoreResultResponse)
def ignore_gog_entries(payload: SyncGogEntriesRequest, db: Session = Depends(get_db)) -> GogIgnoreResultResponse:
    return GogIgnoreResultResponse.model_validate(gog_service.ignore_entries(db, payload.gog_product_ids))


# The GOG wishlist routes also sit above /gog/{gog_product_id}/..., so "wishlist" is never
# read as a product id.
@router.get("/api/integrations/gog/wishlist/entries", response_model=list[GogEntryResponse])
def get_gog_wishlist_entries(db: Session = Depends(get_db)) -> list[GogEntryResponse]:
    return [_gog_entry_response(item) for item in gog_wishlist_service.list_entries(db)]


@router.post("/api/integrations/gog/wishlist/sync", response_model=GogSyncResultResponse)
def sync_gog_wishlist_entries(payload: SyncGogEntriesRequest, db: Session = Depends(get_db)) -> GogSyncResultResponse:
    return GogSyncResultResponse.model_validate(gog_wishlist_service.sync_entries(db, payload.gog_product_ids))


@router.post("/api/integrations/gog/wishlist/ignore", response_model=GogIgnoreResultResponse)
def ignore_gog_wishlist_entries(
    payload: SyncGogEntriesRequest, db: Session = Depends(get_db)
) -> GogIgnoreResultResponse:
    return GogIgnoreResultResponse.model_validate(gog_wishlist_service.ignore_entries(db, payload.gog_product_ids))


@router.post("/api/integrations/gog/wishlist/{gog_product_id}/ignore", response_model=GogEntryResponse)
def ignore_gog_wishlist_entry(gog_product_id: int, db: Session = Depends(get_db)) -> GogEntryResponse:
    return _gog_entry_response(gog_wishlist_service.ignore_entry(db, gog_product_id))


@router.post("/api/integrations/gog/wishlist/{gog_product_id}/unignore", response_model=GogEntryResponse)
def unignore_gog_wishlist_entry(gog_product_id: int, db: Session = Depends(get_db)) -> GogEntryResponse:
    return _gog_entry_response(gog_wishlist_service.unignore_entry(db, gog_product_id))


@router.post("/api/integrations/gog/wishlist/{gog_product_id}/relink", response_model=GogEntryResponse)
def relink_gog_wishlist_entry(
    gog_product_id: int, payload: RelinkSteamEntryRequest, db: Session = Depends(get_db)
) -> GogEntryResponse:
    return _gog_entry_response(gog_wishlist_service.relink_entry(db, gog_product_id, payload.game_id))


@router.post("/api/integrations/gog/wishlist/{gog_product_id}/unlink", response_model=GogEntryResponse)
def unlink_gog_wishlist_entry(gog_product_id: int, db: Session = Depends(get_db)) -> GogEntryResponse:
    return _gog_entry_response(gog_wishlist_service.unlink_entry(db, gog_product_id))


@router.post("/api/integrations/gog/{gog_product_id}/ignore", response_model=GogEntryResponse)
def ignore_gog_entry(gog_product_id: int, db: Session = Depends(get_db)) -> GogEntryResponse:
    return _gog_entry_response(gog_service.ignore_entry(db, gog_product_id))


@router.post("/api/integrations/gog/{gog_product_id}/unignore", response_model=GogEntryResponse)
def unignore_gog_entry(gog_product_id: int, db: Session = Depends(get_db)) -> GogEntryResponse:
    return _gog_entry_response(gog_service.unignore_entry(db, gog_product_id))


@router.post("/api/integrations/gog/{gog_product_id}/relink", response_model=GogEntryResponse)
def relink_gog_entry(
    gog_product_id: int, payload: RelinkSteamEntryRequest, db: Session = Depends(get_db)
) -> GogEntryResponse:
    return _gog_entry_response(gog_service.relink_entry(db, gog_product_id, payload.game_id))


@router.post("/api/integrations/gog/{gog_product_id}/unlink", response_model=GogEntryResponse)
def unlink_gog_entry(gog_product_id: int, db: Session = Depends(get_db)) -> GogEntryResponse:
    return _gog_entry_response(gog_service.unlink_entry(db, gog_product_id))


@router.get("/api/integrations/gog/{gog_product_id}/store-details", response_model=GogStoreDetailsResponse)
async def get_gog_store_details(gog_product_id: int) -> GogStoreDetailsResponse:
    async with GogClient() as client:
        details = await client.get_store_details(gog_product_id)
    if details is None:
        raise NotFoundError(f"No GOG store page found for product {gog_product_id}")
    return GogStoreDetailsResponse(name=details.name, summary=details.summary, cover_url=details.cover_url)


# --- offline installers --------------------------------------------------------------------


@router.get("/api/integrations/gog/games/{game_id}/installers", response_model=GogInstallersResponse)
async def get_gog_installers(
    game_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GogInstallersResponse:
    try:
        result = await gog_service.get_installers(db, current_user, game_id)
    except GogAuthError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return GogInstallersResponse.model_validate(result)


@router.post("/api/integrations/gog/games/{game_id}/installers/download", response_model=GogInstallersResponse)
async def download_gog_installer(
    game_id: int,
    payload: GogQueueInstallerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    session_factory: Callable[[], Session] = Depends(get_session_factory),
) -> GogInstallersResponse:
    """Queues every part of one installer for download to the server and starts the
    download job if it isn't running."""
    try:
        await gog_service.queue_installer(db, current_user, game_id, payload.product_id, payload.installer_id)
        result = await gog_service.get_installers(db, current_user, game_id)
    except GogAuthError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    gog_jobs.ensure_download_job_running(session_factory)
    return GogInstallersResponse.model_validate(result)


@router.get("/api/integrations/gog/downloads", response_model=GogDownloadsResponse)
def get_gog_downloads(
    db: Session = Depends(get_db), session_factory: Callable[[], Session] = Depends(get_session_factory)
) -> GogDownloadsResponse:
    """Everything downloaded or queued on the server. Local only: polling it never calls
    GOG. Also restarts the download job if a queued row is waiting."""
    gog_jobs.ensure_download_job_running(session_factory)
    return GogDownloadsResponse(
        downloads=[_download_response(row) for row in gog_download_service.list_downloads(db)],
        bytes_on_disk=gog_download_service.bytes_on_disk(db),
    )


@router.post("/api/integrations/gog/downloads/{download_id}/retry", response_model=GogDownloadResponse)
def retry_gog_download(
    download_id: int,
    db: Session = Depends(get_db),
    session_factory: Callable[[], Session] = Depends(get_session_factory),
) -> GogDownloadResponse:
    row = gog_download_service.retry(db, download_id)
    gog_jobs.ensure_download_job_running(session_factory)
    return _download_response(row)


@router.delete("/api/integrations/gog/downloads/{download_id}", status_code=204)
def delete_gog_download(download_id: int, db: Session = Depends(get_db)) -> None:
    """Cancels a queued or running download, or deletes a finished one from the server."""
    gog_download_service.delete(db, download_id)


@router.post("/api/integrations/gog/downloads/{download_id}/file-link", response_model=GogFileLinkResponse)
def create_gog_download_link(
    download_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GogFileLinkResponse:
    """A short-lived signed link the browser saves the file from itself: installers can be
    many GB, too big to fetch into memory, and a plain navigation can't carry the
    Authorization header."""
    row = _require_downloaded(db, download_id)
    token = create_gog_installer_token(current_user.id, row.id)
    return GogFileLinkResponse(url=f"/api/integrations/gog/downloads/{row.id}/file/{token}/{quote(row.filename or '')}")


def _require_downloaded(db: Session, download_id: int) -> GogDownload:
    row = gog_download_service.get_download(db, download_id)
    if not gog_download_service.is_on_disk(row):
        raise NotFoundError("That installer isn't downloaded to the server")
    return row


def _download_response(row: GogDownload) -> GogDownloadResponse:
    game = row.game
    return GogDownloadResponse(
        id=row.id,
        game_id=row.game_id,
        game_name=game.name if game else None,
        game_slug=game.slug if game else None,
        product_id=row.gog_product_id,
        installer_id=row.installer_id,
        file_id=row.file_id,
        filename=row.filename,
        status=row.status,
        total_size=row.total_size,
        downloaded_bytes=row.downloaded_bytes,
        error=row.error,
    )


# The signed file route carries no Authorization header (it's a plain browser navigation),
# so it lives on its own router without the router-wide sign-in check, like the full-backup
# download in import_export.py.
download_router = APIRouter(tags=["integrations"])


@download_router.get("/api/integrations/gog/downloads/{download_id}/file/{token}/{filename}")
def save_gog_download(download_id: int, token: str, filename: str, db: Session = Depends(get_db)) -> FileResponse:
    try:
        payload = decode_token(token, TokenType.GOG_INSTALLER)
    except TokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired download link") from exc
    if payload.get("download") != download_id or db.get(User, int(payload["sub"])) is None:
        raise HTTPException(status_code=401, detail="Invalid or expired download link")
    row = _require_downloaded(db, download_id)
    path = gog_download_service.file_path(row)
    return FileResponse(path, media_type="application/octet-stream", filename=row.filename)


def _gog_entry_response(
    item: "gog_service.GogEntryWithStatus | gog_wishlist_service.GogWishlistEntryWithStatus",
) -> GogEntryResponse:
    entry = item.entry
    game = entry.game
    return GogEntryResponse(
        gog_product_id=entry.gog_product_id,
        gog_name=entry.gog_name,
        status=item.status.value,
        game_id=game.id if game else None,
        game_name=game.name if game else None,
        game_slug=game.slug if game else None,
        game_cover_url=game.cover_url if game else None,
        parent_game_id=game.parent_game_id if game else None,
    )


def _wishlist_entry_response(
    item: "steam_wishlist_service.SteamWishlistEntryWithStatus",
) -> SteamWishlistEntryResponse:
    entry = item.entry
    game = entry.game
    return SteamWishlistEntryResponse(
        steam_app_id=entry.steam_app_id,
        steam_name=entry.steam_name,
        wishlist_added_at=entry.wishlist_added_at,
        status=item.status.value,
        game_id=game.id if game else None,
        game_name=game.name if game else None,
        game_slug=game.slug if game else None,
        game_cover_url=game.cover_url if game else None,
        parent_game_id=game.parent_game_id if game else None,
    )


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
        parent_game_id=game.parent_game_id if game else None,
    )
