from app.schemas.base import CamelModel


class VersionResponse(CamelModel):
    current_version: str
    latest_version: str | None
    update_available: bool
    release_url: str | None
