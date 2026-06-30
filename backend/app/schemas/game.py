from app.models.catalog import Game, GameCategory
from app.models.library import GameProgress, PlayStatus, Tag
from app.repositories.game_repository import GameWithStatus
from app.schemas.base import CamelModel
from app.schemas.catalog import (
    CatalogRefResponse,
    GameCompanyResponse,
    GameVideoResponse,
    ReleaseDateResponse,
    collection_ref_from_orm,
    franchise_ref_from_orm,
    game_company_from_orm,
    game_video_from_orm,
    genre_ref_from_orm,
    release_date_from_orm,
)
from app.schemas.platform import PlatformResponse
from app.schemas.progress import GameProgressResponse, game_progress_from_orm
from app.schemas.tag import TagResponse, tag_from_orm


class GameSummaryResponse(CamelModel):
    id: int
    uuid: str
    igdb_id: int | None
    name: str
    slug: str | None
    cover_url: str | None
    category: GameCategory | None
    first_release_date: int | None
    # Computed fresh per request (EXISTS/scalar-subquery against library_items and
    # game_progress), never a stored counter — see GameWithStatus and the audit's
    # owned/wishlisted-counter finding.
    owned: bool
    wishlisted: bool
    play_status: PlayStatus | None
    rating: float | None


class GameDetailResponse(GameSummaryResponse):
    summary: str | None
    storyline: str | None
    edition: str | None
    igdb_url: str | None
    parent_game_id: int | None
    parent_game_name: str | None
    parent_game_slug: str | None
    parent_game_uuid: str | None
    display_parent_game_id: int | None
    display_parent_game_name: str | None
    display_parent_game_slug: str | None
    display_parent_game_uuid: str | None
    external_parent_name: str | None
    external_parent_igdb_url: str | None
    progress: GameProgressResponse
    tags: list[TagResponse]
    genres: list[CatalogRefResponse]
    companies: list[GameCompanyResponse]
    franchises: list[CatalogRefResponse]
    collections: list[CatalogRefResponse]
    platforms: list[PlatformResponse]
    screenshot_urls: list[str]
    artwork_urls: list[str]
    videos: list[GameVideoResponse]
    release_dates: list[ReleaseDateResponse]


def _game_fields(game: Game, status: GameWithStatus) -> dict:
    return {
        "id": game.id,
        "uuid": game.uuid,
        "igdb_id": game.igdb_id,
        "name": game.name,
        "slug": game.slug,
        "cover_url": game.cover_url,
        "category": game.category,
        "first_release_date": game.first_release_date,
        "owned": status.owned,
        "wishlisted": status.wishlisted,
        "play_status": status.play_status,
        "rating": status.rating,
    }


def game_summary_from_orm(status: GameWithStatus) -> GameSummaryResponse:
    return GameSummaryResponse(**_game_fields(status.game, status))


def game_detail_from_orm(status: GameWithStatus, progress: GameProgress | None, tags: list[Tag]) -> GameDetailResponse:
    game = status.game
    # parent_game_name comes from the `parent_game` relationship, not a plain column, so
    # this can't just be GameDetailResponse.model_validate(game, from_attributes=True).
    return GameDetailResponse(
        **_game_fields(game, status),
        summary=game.summary,
        storyline=game.storyline,
        edition=game.edition,
        igdb_url=game.igdb_url,
        parent_game_id=game.parent_game_id,
        parent_game_name=game.parent_game.name if game.parent_game else None,
        parent_game_slug=game.parent_game.slug if game.parent_game else None,
        parent_game_uuid=game.parent_game.uuid if game.parent_game else None,
        display_parent_game_id=game.display_parent_game_id,
        display_parent_game_name=game.display_parent_game.name if game.display_parent_game else None,
        display_parent_game_slug=game.display_parent_game.slug if game.display_parent_game else None,
        display_parent_game_uuid=game.display_parent_game.uuid if game.display_parent_game else None,
        external_parent_name=game.external_parent_name,
        external_parent_igdb_url=game.external_parent_igdb_url,
        progress=game_progress_from_orm(game.id, progress),
        tags=[tag_from_orm(tag) for tag in tags],
        genres=[genre_ref_from_orm(gg.genre) for gg in game.genres],
        companies=[game_company_from_orm(gc) for gc in game.companies],
        franchises=[franchise_ref_from_orm(gf.franchise) for gf in game.franchises],
        collections=[collection_ref_from_orm(gcol.collection) for gcol in game.collections],
        platforms=[PlatformResponse.model_validate(gp.platform) for gp in game.platforms],
        screenshot_urls=[s.url for s in game.screenshots],
        artwork_urls=[a.url for a in game.artworks],
        videos=[game_video_from_orm(v) for v in game.videos],
        release_dates=[release_date_from_orm(rd) for rd in game.release_dates],
    )


class GameImportRequest(CamelModel):
    igdb_id: int


class IGDBParentGameResponse(CamelModel):
    igdb_id: int
    name: str


class IGDBSearchResultResponse(CamelModel):
    igdb_id: int
    name: str
    slug: str | None
    summary: str | None
    cover_url: str | None
    category: GameCategory | None
    first_release_date: int | None
    parent_game: IGDBParentGameResponse | None = None
