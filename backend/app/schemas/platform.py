from app.schemas.base import CamelModel


class PlatformResponse(CamelModel):
    id: int
    igdb_id: int | None
    name: str
    slug: str | None
    abbreviation: str | None
