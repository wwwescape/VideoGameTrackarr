from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.game_filters import GameFilterParams
from app.schemas.collection import (
    CollectionDetailResponse,
    CollectionSummaryResponse,
    collection_detail_from_orm,
    collection_summary_from_orm,
)
from app.schemas.game import GameSummaryResponse, game_summary_from_orm
from app.services import collection_service, insight_service

router = APIRouter(prefix="/api/collections", tags=["collections"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[CollectionSummaryResponse])
def list_collections(db: Session = Depends(get_db)) -> list[CollectionSummaryResponse]:
    collections = collection_service.list_collections(db)
    return [collection_summary_from_orm(collection, count) for collection, count in collections]


@router.get("/{slug}", response_model=CollectionDetailResponse)
def get_collection(slug: str, db: Session = Depends(get_db)) -> CollectionDetailResponse:
    collection, games, addons = collection_service.get_collection_with_games(db, slug)
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    return collection_detail_from_orm(collection, games, addons, on_sale_game_ids)


@router.get("/{slug}/addons", response_model=list[GameSummaryResponse])
def list_collection_addons(
    slug: str, params: GameFilterParams = Depends(), db: Session = Depends(get_db)
) -> list[GameSummaryResponse]:
    addons = collection_service.list_collection_addons(db, slug, **vars(params))
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    return [game_summary_from_orm(addon, on_sale_game_ids) for addon in addons]
