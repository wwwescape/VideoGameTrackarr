from datetime import datetime

from app.schemas.base import CamelModel


class IntegrationsStatusResponse(CamelModel):
    igdb_configured: bool
    steam_api_key_configured: bool
    steam_id_64: str | None
    itad_configured: bool
    itad_country: str
    platprices_configured: bool
    platprices_region: str
    gog_configured: bool
    gog_username: str | None


class UpdateSteamIdRequest(CamelModel):
    steam_id_64: str | None


class SteamEntryResponse(CamelModel):
    steam_app_id: int
    steam_name: str
    steam_playtime_minutes: int
    steam_last_played_at: datetime | None
    status: str
    game_id: int | None
    game_name: str | None
    game_slug: str | None
    game_cover_url: str | None
    vgt_playtime_minutes: int | None
    # The matched game's parent (if any) — lets the Steam Sync page nest a DLC/expansion/
    # pack row under its parent's row instead of listing it flat.
    parent_game_id: int | None


class SyncSteamEntriesRequest(CamelModel):
    steam_app_ids: list[int]


class RelinkSteamEntryRequest(CamelModel):
    game_id: int


class SyncResultFailure(CamelModel):
    steam_app_id: int
    error: str


class SyncResultResponse(CamelModel):
    synced: int
    failed: int
    failures: list[SyncResultFailure]


class IgnoreResultResponse(CamelModel):
    ignored: int
    failed: int
    failures: list[SyncResultFailure]


class SteamStoreDetailsResponse(CamelModel):
    name: str
    summary: str | None
    cover_url: str | None


class SteamWishlistEntryResponse(CamelModel):
    steam_app_id: int
    steam_name: str
    wishlist_added_at: datetime | None
    status: str
    game_id: int | None
    game_name: str | None
    game_slug: str | None
    game_cover_url: str | None
    parent_game_id: int | None


class GogStatusResponse(CamelModel):
    configured: bool
    username: str | None
    authorize_url: str


class GogConnectRequest(CamelModel):
    redirect_url: str


class GogEntryResponse(CamelModel):
    gog_product_id: int
    gog_name: str
    status: str
    game_id: int | None
    game_name: str | None
    game_slug: str | None
    game_cover_url: str | None
    # The matched game's parent (if any) — lets the GOG Sync page nest a DLC/expansion/
    # pack row under its parent's row instead of listing it flat.
    parent_game_id: int | None


class SyncGogEntriesRequest(CamelModel):
    gog_product_ids: list[int]


class RelinkGogEntryRequest(CamelModel):
    game_id: int


class GogSyncResultFailure(CamelModel):
    gog_product_id: int
    error: str


class GogSyncResultResponse(CamelModel):
    synced: int
    failed: int
    failures: list[GogSyncResultFailure]


class GogIgnoreResultResponse(CamelModel):
    ignored: int
    failed: int
    failures: list[GogSyncResultFailure]


class GogInstallerFileResponse(CamelModel):
    id: str
    size: int
    # NAS download state for this file: not_downloaded / queued / downloading /
    # completed / failed. A completed file downloads to the device from the NAS
    # through the file route; anything else goes through the queue first.
    download_state: str
    downloaded_bytes: int
    download_error: str | None


class GogInstallerResponse(CamelModel):
    id: str
    os: str
    language: str
    version: str | None
    total_size: int
    files: list[GogInstallerFileResponse]


class GogInstallerGroupResponse(CamelModel):
    product_id: int
    title: str
    installers: list[GogInstallerResponse]


class GogInstallersResponse(CamelModel):
    game_id: int
    gog_product_id: int
    groups: list[GogInstallerGroupResponse]


class GogQueueDownloadRequest(CamelModel):
    installer_id: str
    file_id: str


class GogDownloadResponse(CamelModel):
    file_id: str
    status: str
    total_size: int
    downloaded_bytes: int
    filename: str | None
    error: str | None


class GogDownloadLinkResponse(CamelModel):
    # A short-lived tokenized URL the browser navigates to directly — the file can
    # be many GB, so it streams to disk instead of passing through a script.
    url: str
