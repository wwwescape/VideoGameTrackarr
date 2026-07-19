from pydantic import Field

from app.schemas.base import CamelModel


class LoginRequest(CamelModel):
    username: str
    password: str


class RefreshRequest(CamelModel):
    refresh_token: str


class TokenResponse(CamelModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(CamelModel):
    id: int
    username: str


class SetupStatusResponse(CamelModel):
    setup_required: bool


class SetupRequest(CamelModel):
    """Minimal provisioning validation that plain LoginRequest deliberately skips —
    login must accept whatever's already stored, but the first-run form is the one place
    that gets to reject a weak account before it's created."""

    username: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8)
