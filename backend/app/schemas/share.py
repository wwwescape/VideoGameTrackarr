from app.schemas.base import CamelModel


class ShareLinkResponse(CamelModel):
    # None while sharing is off.
    token: str | None
