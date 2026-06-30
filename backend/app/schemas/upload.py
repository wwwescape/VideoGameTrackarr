from app.schemas.base import CamelModel


class UploadResponse(CamelModel):
    url: str
