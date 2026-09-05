from datetime import datetime

from app.schemas.base import CamelModel


class IntegrationsStatusResponse(CamelModel):
    igdb_configured: bool
    steam_api_key_configured: bool
    steam_id_64: str | None
    itad_configured: bool
    platprices_configured: bool


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


class SyncResultFailure(CamelModel):
    steam_app_id: int
    error: str


class SyncResultResponse(CamelModel):
    synced: int
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
