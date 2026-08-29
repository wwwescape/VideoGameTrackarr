from app.schemas.base import CamelModel


class ShareLinkResponse(CamelModel):
    token: str
