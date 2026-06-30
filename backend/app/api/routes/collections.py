from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.collection import (
    CollectionDetailResponse,
    CollectionSummaryResponse,
    collection_detail_from_orm,
    collection_summary_from_orm,
)
from app.services import collection_service

router = APIRouter(prefix="/api/collections", tags=["collections"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[CollectionSummaryResponse])
def list_collections(db: Session = Depends(get_db)) -> list[CollectionSummaryResponse]:
    collections = collection_service.list_collections(db)
    return [collection_summary_from_orm(collection, count) for collection, count in collections]


@router.get("/{slug}", response_model=CollectionDetailResponse)
def get_collection(slug: str, db: Session = Depends(get_db)) -> CollectionDetailResponse:
    collection, games = collection_service.get_collection_with_games(db, slug)
    return collection_detail_from_orm(collection, games)
