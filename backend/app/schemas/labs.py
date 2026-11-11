from app.schemas.base import CamelModel


class LabResponse(CamelModel):
    id: str
    enabled: bool


class LabUpdateRequest(CamelModel):
    enabled: bool


class PublicLabsResponse(CamelModel):
    # The ids of the labs that are on.
    enabled: list[str]
