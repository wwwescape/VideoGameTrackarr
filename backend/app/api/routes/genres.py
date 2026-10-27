from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.genre import GenreResponse, genre_from_orm
from app.services import genre_service

router = APIRouter(tags=["genres"], dependencies=[Depends(get_current_user)])


@router.get("/api/genres", response_model=list[GenreResponse])
def list_genres(db: Session = Depends(get_db)) -> list[GenreResponse]:
    return [genre_from_orm(genre, count) for genre, count in genre_service.list_library_genres(db)]
