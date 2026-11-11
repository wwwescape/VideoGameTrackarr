from app.models.game_cases import GameCase
from app.schemas.base import CamelModel
from app.services.game_case_service import GameCaseRow


class GameCaseLookResponse(CamelModel):
    """How a platform's games are drawn on the shelf: the case's real size and its colours."""

    platform_slug: str
    case_label: str
    height_mm: float
    spine_mm: float
    case_top_mm: float
    case_color: str
    logo_band_color: str
    logo_band_height_pct: float
    # A file in the frontend's assets/game-cases/; null shows the platform's short name.
    logo: str | None
    logo_color: str | None
    logo_line_color: str | None
    title_band_color: str
    title_text_color: str


class GameCaseResponse(GameCaseLookResponse):
    """A Settings > Game Cases row."""

    id: int
    platform_name: str
    shown: bool
    physical_games: int
    abbreviation: str | None
    logo_url: str | None


class GameCaseUpdateRequest(CamelModel):
    shown: bool


def game_case_look(case: GameCase) -> GameCaseLookResponse:
    return GameCaseLookResponse.model_validate(case, from_attributes=True)


def game_case_from_row(row: GameCaseRow) -> GameCaseResponse:
    return GameCaseResponse(
        **game_case_look(row.case).model_dump(),
        id=row.case.id,
        platform_name=row.case.platform_name,
        shown=row.case.shown,
        physical_games=row.physical_games,
        abbreviation=row.abbreviation,
        logo_url=row.logo_url,
    )
