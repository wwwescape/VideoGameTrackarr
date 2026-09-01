from datetime import datetime
from typing import Literal

from app.schemas.base import CamelModel

SalesProvider = Literal["itad", "platprices"]


class IgnoredSalesTitleResponse(CamelModel):
    provider: SalesProvider
    game_id: int
    game_uuid: str
    game_name: str
    game_slug: str | None
    game_cover_url: str | None
    checked_at: datetime | None
