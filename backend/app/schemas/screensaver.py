from pydantic import Field

from app.schemas.base import CamelModel
from app.services.screensaver_service import ScreensaverSample


class ScreensaverGameResponse(CamelModel):
    """One slide: just what the carousel shows and what opening the game's page needs."""

    id: int
    uuid: str
    slug: str | None
    name: str
    cover_url: str


class ScreensaverResponse(CamelModel):
    # In random order, at most screensaver_service.SAMPLE_SIZE of them.
    games: list[ScreensaverGameResponse]
    total: int


class ScreensaverExcludedRequest(CamelModel):
    excluded: bool


class ScreensaverExcludedResponse(CamelModel):
    id: int
    excluded: bool


class ScreensaverBulkRequest(CamelModel):
    game_ids: list[int] = Field(min_length=1, max_length=10_000)
    excluded: bool


class ScreensaverBulkResponse(CamelModel):
    updated: int


def screensaver_response(sample: ScreensaverSample) -> ScreensaverResponse:
    return ScreensaverResponse(
        games=[
            ScreensaverGameResponse(id=g.id, uuid=g.uuid, slug=g.slug, name=g.name, cover_url=g.cover_url)
            for g in sample.games
        ],
        total=sample.total,
    )
