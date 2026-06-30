from app.schemas.base import CamelModel


class CompanyResponse(CamelModel):
    id: int
    name: str
