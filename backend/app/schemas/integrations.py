from datetime import datetime

from pydantic import Field

from app.schemas.base import CamelModel


class IntegrationsStatusResponse(CamelModel):
    igdb_configured: bool
    steam_api_key_configured: bool
    steam_id_64: str | None
    itad_configured: bool
    itad_country: str
    platprices_configured: bool
    platprices_region: str
    gog_connected: bool
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
    connected: bool
    username: str | None
    # GOG's sign-in page, opened in a popup by the Integrations page.
    login_url: str


class GogConnectRequest(CamelModel):
    # The address of the page GOG lands on after signing in (or just its code).
    redirect_url: str = Field(min_length=1, max_length=4096)


class GogEntryResponse(CamelModel):
    gog_product_id: int
    gog_name: str
    status: str
    game_id: int | None
    game_name: str | None
    game_slug: str | None
    game_cover_url: str | None
    # The matched game's parent, so the GOG Sync page can nest DLC under it.
    parent_game_id: int | None


class SyncGogEntriesRequest(CamelModel):
    gog_product_ids: list[int]


class GogResultFailure(CamelModel):
    gog_product_id: int
    error: str


class GogSyncResultResponse(CamelModel):
    synced: int
    failed: int
    failures: list[GogResultFailure]


class GogIgnoreResultResponse(CamelModel):
    ignored: int
    failed: int
    failures: list[GogResultFailure]


class GogStoreDetailsResponse(CamelModel):
    name: str
    summary: str | None
    cover_url: str | None


class GogInstallerPartResponse(CamelModel):
    id: str
    size: int
    # Set once this part has a row on the server (queued, downloading, done or failed).
    download_id: int | None
    # not_downloaded / queued / downloading / completed / failed
    state: str
    downloaded_bytes: int
    error: str | None
    filename: str | None


class GogInstallerResponse(CamelModel):
    id: str
    os: str
    language: str
    version: str | None
    total_size: int
    files: list[GogInstallerPartResponse]


class GogInstallerGroupResponse(CamelModel):
    product_id: int
    title: str
    installers: list[GogInstallerResponse]


class GogInstallersResponse(CamelModel):
    game_id: int
    groups: list[GogInstallerGroupResponse]


class GogQueueInstallerRequest(CamelModel):
    product_id: int
    installer_id: str = Field(min_length=1, max_length=64)


class GogDownloadResponse(CamelModel):
    id: int
    game_id: int
    game_name: str | None
    game_slug: str | None
    product_id: int
    installer_id: str
    file_id: str
    filename: str | None
    status: str
    total_size: int
    downloaded_bytes: int
    error: str | None


class GogDownloadsResponse(CamelModel):
    downloads: list[GogDownloadResponse]
    # What the finished installers take up on the server.
    bytes_on_disk: int


class GogFileLinkResponse(CamelModel):
    url: str
