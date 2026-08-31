from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_igdb_client
from app.repositories import steam_repository
from app.repositories.game_repository import GameWithStatus
from app.schemas.game import (
    GameDetailResponse,
    GameImportRequest,
    GameSummaryResponse,
    game_detail_from_orm,
    game_summary_from_orm,
)
from app.schemas.manual_game import ManualGameCreateRequest, ManualGameUpdateRequest
from app.services import game_service, insight_service, manual_game_service, progress_service, tag_service
from app.services.igdb_client import IGDBClient

router = APIRouter(prefix="/api/games", tags=["games"], dependencies=[Depends(get_current_user)])


def _game_detail_response(db: Session, game: GameWithStatus) -> GameDetailResponse:
    progress = progress_service.get_derived_progress(db, game.game.id)
    tags = tag_service.list_tags_for_game(db, game.game.id)
    steam_entry = steam_repository.get_entry_by_game_id(db, game.game.id)
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    return game_detail_from_orm(
        game,
        progress,
        tags,
        steam_app_id=steam_entry.steam_app_id if steam_entry else None,
        on_sale_game_ids=on_sale_game_ids,
    )


@router.get("", response_model=list[GameSummaryResponse])
def list_games(
    search: str | None = Query(default=None),
    platform_ids: list[int] | None = Query(default=None, alias="platformId"),
    tag_ids: list[int] | None = Query(default=None, alias="tagId"),
    collection_id: int | None = Query(default=None, alias="collectionId"),
    franchise_id: int | None = Query(default=None, alias="franchiseId"),
    db: Session = Depends(get_db),
) -> list[GameSummaryResponse]:
    games = game_service.search_local_games(
        db,
        search=search,
        platform_ids=platform_ids,
        tag_ids=tag_ids,
        collection_id=collection_id,
        franchise_id=franchise_id,
    )
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    return [game_summary_from_orm(game, on_sale_game_ids) for game in games]


@router.get("/{identifier}", response_model=GameDetailResponse)
def get_game(identifier: str, db: Session = Depends(get_db)) -> GameDetailResponse:
    game = game_service.get_game_detail_by_identifier(db, identifier)
    return _game_detail_response(db, game)


@router.delete("/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_game(game_id: int, db: Session = Depends(get_db)) -> None:
    game_service.delete_game(db, game_id)


@router.get("/{game_id}/addons", response_model=list[GameSummaryResponse])
def list_addons(game_id: int, db: Session = Depends(get_db)) -> list[GameSummaryResponse]:
    addons = game_service.list_addons(db, game_id)
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    return [game_summary_from_orm(addon, on_sale_game_ids) for addon in addons]


@router.post("", response_model=GameDetailResponse, status_code=status.HTTP_201_CREATED)
async def import_game(
    body: GameImportRequest,
    db: Session = Depends(get_db),
    igdb_client: IGDBClient = Depends(get_igdb_client),
) -> GameDetailResponse:
    game = await game_service.import_game_from_igdb(db, igdb_client, body.igdb_id)
    return _game_detail_response(db, game)


@router.post("/manual", response_model=GameDetailResponse, status_code=status.HTTP_201_CREATED)
def create_manual_game(body: ManualGameCreateRequest, db: Session = Depends(get_db)) -> GameDetailResponse:
    game = manual_game_service.create_manual_game(
        db,
        name=body.name,
        category=body.category,
        first_release_date=body.first_release_date,
        summary=body.summary,
        storyline=body.storyline,
        edition=body.edition,
        cover_url=body.cover_url,
        parent_game_id=body.parent_game_id,
        developed_by=body.developed_by,
        published_by=body.published_by,
        platform_names=body.platform_names,
        notes=body.notes,
        steam_app_id=body.steam_app_id,
    )
    return _game_detail_response(db, game)


@router.patch("/{game_id}/manual", response_model=GameDetailResponse)
def update_manual_game(
    game_id: int, body: ManualGameUpdateRequest, db: Session = Depends(get_db)
) -> GameDetailResponse:
    game = manual_game_service.update_manual_game(db, game_id, **body.model_dump(exclude_unset=True))
    return _game_detail_response(db, game)


@router.post("/{game_id}/resync", response_model=GameDetailResponse)
async def resync_game(
    game_id: int,
    db: Session = Depends(get_db),
    igdb_client: IGDBClient = Depends(get_igdb_client),
) -> GameDetailResponse:
    game = await game_service.resync_game(db, igdb_client, game_id)
    return _game_detail_response(db, game)


@router.post("/{game_id}/link-igdb", response_model=GameDetailResponse)
async def link_game_to_igdb(
    game_id: int,
    body: GameImportRequest,
    db: Session = Depends(get_db),
    igdb_client: IGDBClient = Depends(get_igdb_client),
) -> GameDetailResponse:
    game = await game_service.link_game_to_igdb(db, igdb_client, game_id, body.igdb_id)
    return _game_detail_response(db, game)


@router.post("/{game_id}/link-igdb-via-parent", response_model=GameDetailResponse)
async def link_game_to_igdb_via_parent(
    game_id: int,
    body: GameImportRequest,
    db: Session = Depends(get_db),
    igdb_client: IGDBClient = Depends(get_igdb_client),
) -> GameDetailResponse:
    game = await game_service.link_addon_via_new_parent(db, igdb_client, game_id, body.igdb_id)
    return _game_detail_response(db, game)


@router.post("/{game_id}/merge-into-igdb", response_model=GameDetailResponse)
def merge_game_into_igdb(
    game_id: int,
    body: GameImportRequest,
    db: Session = Depends(get_db),
) -> GameDetailResponse:
    game = game_service.merge_duplicate_game(db, game_id, body.igdb_id)
    return _game_detail_response(db, game)
