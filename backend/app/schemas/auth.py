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


class PreferencesRequest(CamelModel):
    # An ISO 4217 code; the frontend only offers the currencies it can format.
    currency: str = Field(pattern=r"^[A-Z]{3}$")


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
