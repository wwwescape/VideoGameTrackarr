from app.schemas.base import CamelModel
from app.schemas.game_case import GameCaseLookResponse, game_case_look
from app.services.game_shelf_service import Shelf


class ShelfPlatformResponse(CamelModel):
    """A platform on the shelf and the case its games are drawn in. Nothing private in it, so
    the share page's shelf sends the same."""

    id: int
    name: str
    slug: str | None
    # The short name the logo band shows when the case has no logo file.
    abbreviation: str | None
    logo_url: str | None
    case: GameCaseLookResponse


class ShelfCaseResponse(CamelModel):
    """One case on the Game Shelf: a game on one platform you own a physical copy on."""

    game_id: int
    uuid: str
    slug: str | None
    name: str
    platform_id: int


class GameShelfResponse(CamelModel):
    # In the requested sort order.
    cases: list[ShelfCaseResponse]
    platforms: list[ShelfPlatformResponse]


# The share page's shelf: which platform each game is on, nothing else about your copies.
class PublicShelfCaseResponse(CamelModel):
    game_id: int
    name: str
    platform_id: int


class PublicGameShelfResponse(CamelModel):
    cases: list[PublicShelfCaseResponse]
    platforms: list[ShelfPlatformResponse]


def _platforms(shelf: Shelf) -> list[ShelfPlatformResponse]:
    return [
        ShelfPlatformResponse(
            id=entry.platform.id,
            name=entry.platform.name,
            slug=entry.platform.slug,
            abbreviation=entry.platform.abbreviation,
            logo_url=entry.platform.logo_url,
            case=game_case_look(entry.case),
        )
        for entry in shelf.platforms
    ]


def game_shelf_response(shelf: Shelf) -> GameShelfResponse:
    return GameShelfResponse(
        cases=[ShelfCaseResponse.model_validate(case, from_attributes=True) for case in shelf.cases],
        platforms=_platforms(shelf),
    )


def public_game_shelf_response(shelf: Shelf) -> PublicGameShelfResponse:
    return PublicGameShelfResponse(
        cases=[
            PublicShelfCaseResponse(game_id=case.game_id, name=case.name, platform_id=case.platform_id)
            for case in shelf.cases
        ],
        platforms=_platforms(shelf),
    )
