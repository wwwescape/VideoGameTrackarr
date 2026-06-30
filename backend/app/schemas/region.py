from app.schemas.base import CamelModel


class RegionResponse(CamelModel):
    id: int
    name: str
