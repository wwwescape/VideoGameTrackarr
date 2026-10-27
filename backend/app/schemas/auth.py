import json
from typing import Any

from pydantic import Field, field_validator

from app.schemas.base import CamelModel

# bcrypt only uses a password's first 72 bytes, so a longer one would be silently cut short.
BCRYPT_MAX_BYTES = 72


def _check_bcrypt_length(value: str) -> str:
    if len(value.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise ValueError(f"Password must be at most {BCRYPT_MAX_BYTES} bytes")
    return value


class LoginRequest(CamelModel):
    username: str
    password: str


class ChangePasswordRequest(CamelModel):
    """The new password gets the same minimum as the first-run form (SetupRequest); the
    current one is checked as stored, like login."""

    current_password: str
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def _fits_bcrypt(cls, value: str) -> str:
        return _check_bcrypt_length(value)


class OverviewSection(CamelModel):
    # The frontend's section keys (OverviewPage); keys it doesn't know are ignored there, so a
    # layout saved by a newer version still loads after a downgrade.
    key: str = Field(pattern=r"^[a-zA-Z][a-zA-Z0-9]{0,39}$")
    hidden: bool = False


class GameFilterField(CamelModel):
    # The Filter dialog's field keys (GameFilterDialog); like OverviewSection, keys the
    # frontend doesn't know are ignored there.
    key: str = Field(pattern=r"^[a-zA-Z][a-zA-Z0-9]{0,39}$")
    hidden: bool = False


class SavedGameFilter(CamelModel):
    name: str = Field(min_length=1, max_length=60)
    # The game list's filter state as the frontend keeps it (useGameListState), stored as-is:
    # the server never reads it, and the frontend drops whatever it no longer knows.
    filters: dict[str, Any]

    @field_validator("filters")
    @classmethod
    def _filters_are_small(cls, value: dict[str, Any]) -> dict[str, Any]:
        if len(value) > 100 or len(json.dumps(value)) > 10_000:
            raise ValueError("too many filters")
        return value


class PreferencesRequest(CamelModel):
    """Only the fields sent are changed, so each preference can be saved independently."""

    # An ISO 4217 code; the frontend only offers the currencies it can format.
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    overview_layout: list[OverviewSection] | None = Field(default=None, max_length=50)
    game_filter_fields: list[GameFilterField] | None = Field(default=None, max_length=50)
    saved_game_filters: list[SavedGameFilter] | None = Field(default=None, max_length=50)


class RefreshRequest(CamelModel):
    refresh_token: str


class TokenResponse(CamelModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(CamelModel):
    id: int
    username: str
    currency: str | None = None
    overview_layout: list[OverviewSection] | None = None
    game_filter_fields: list[GameFilterField] | None = None
    saved_game_filters: list[SavedGameFilter] | None = None


class SetupStatusResponse(CamelModel):
    setup_required: bool


class SetupRequest(CamelModel):
    """Minimal provisioning validation that plain LoginRequest deliberately skips —
    login must accept whatever's already stored, but the first-run form is the one place
    that gets to reject a weak account before it's created."""

    username: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8)
    # The one-time code printed in the server's log (or SETUP_CODE): proves whoever creates
    # the first account has access to the server, not just to its web address.
    setup_code: str = Field(min_length=1, max_length=64)

    @field_validator("password")
    @classmethod
    def _fits_bcrypt(cls, value: str) -> str:
        return _check_bcrypt_length(value)
