from datetime import datetime
from typing import Any

from pydantic import Field

from app.models.connector import ConnectorAbsentMode, ConnectorKind
from app.models.library import MediaFormat
from app.schemas.base import CamelModel

SLUG_PATTERN = r"^[a-z0-9][a-z0-9-]{1,59}$"


class ConnectorRequest(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    # Lowercase letters, digits and dashes: it's part of the URL a device talks to.
    slug: str = Field(pattern=SLUG_PATTERN)
    platform_id: int | None = None
    media_format: MediaFormat | None = None
    digital_storefront: str | None = Field(default=None, max_length=100)
    wishlist: bool = False
    absent_mode: ConnectorAbsentMode = ConnectorAbsentMode.KEEP


class ConnectorCreateRequest(ConnectorRequest):
    kind: ConnectorKind = ConnectorKind.CUSTOM


class ConnectorDeviceResponse(CamelModel):
    id: int
    name: str
    created_at: datetime
    last_seen_at: datetime | None


class ConnectorResponse(CamelModel):
    id: int
    name: str
    slug: str
    kind: ConnectorKind
    platform_id: int | None
    media_format: MediaFormat | None
    digital_storefront: str | None
    wishlist: bool
    absent_mode: ConnectorAbsentMode
    last_sync_at: datetime | None
    last_sync_result: dict[str, Any] | None
    devices: list[ConnectorDeviceResponse]
    # Games it reports now, and ones a complete sync no longer listed.
    present_count: int
    absent_count: int


class ConnectorGameResponse(CamelModel):
    external_id: str
    name: str
    game_id: int | None
    present: bool


class PairingInfoResponse(CamelModel):
    code: str
    device_name: str
    connector_id: int
    connector_name: str
    expires_at: datetime


# --- The device-facing API (app/api/routes/connect.py) ---


class PairRequest(CamelModel):
    device_name: str = Field(default="Device", min_length=1, max_length=100)


class PairResponse(CamelModel):
    code: str
    poll_token: str
    # Where to approve the code in the app (also shown by the device, e.g. as a QR code).
    approve_url: str
    expires_at: datetime


class PollRequest(CamelModel):
    poll_token: str = Field(min_length=1, max_length=100)


class PollResponse(CamelModel):
    status: str
    # Only on the first poll after approval: what the device sends as its Bearer token.
    token: str | None = None


class ReportedGameRequest(CamelModel):
    # The device's own id for the game: a Switch title ID for NX Remote Launcher, anything
    # stable otherwise (a launcher's id, or just the name).
    id: str = Field(min_length=1, max_length=100)
    name: str | None = Field(default=None, max_length=512)
    igdb_id: int | None = None
    players: int | None = Field(default=None, ge=1, le=99)


class SyncRequest(CamelModel):
    games: list[ReportedGameRequest] = Field(max_length=5000)
    # True when `games` is everything the device has, so what's missing from it is gone;
    # false to only add these.
    complete: bool = True


class SyncResponse(CamelModel):
    added: int
    existing: int
    absent: int
    # Ids that couldn't be turned into a game (an unknown Switch title ID with no name).
    unknown: list[str]
