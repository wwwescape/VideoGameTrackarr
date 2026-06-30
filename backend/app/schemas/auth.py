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
