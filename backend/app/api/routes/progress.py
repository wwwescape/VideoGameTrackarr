from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.play_session import (
    PlaySessionCreateRequest,
    PlaySessionResponse,
    PlaySessionUpdateRequest,
    play_session_from_orm,
)
from app.schemas.progress import GameProgressResponse, GameProgressUpdateRequest, game_progress_from_orm
from app.services import progress_service

router = APIRouter(tags=["progress"], dependencies=[Depends(get_current_user)])


@router.get("/api/games/{game_id}/progress", response_model=GameProgressResponse)
def get_progress(game_id: int, db: Session = Depends(get_db)) -> GameProgressResponse:
    progress = progress_service.get_progress(db, game_id)
    return game_progress_from_orm(game_id, progress)


@router.put("/api/games/{game_id}/progress", response_model=GameProgressResponse)
def update_progress(
    game_id: int, body: GameProgressUpdateRequest, db: Session = Depends(get_db)
) -> GameProgressResponse:
    progress = progress_service.update_progress(db, game_id, **body.model_dump(exclude_unset=True))
    return game_progress_from_orm(game_id, progress)


@router.get("/api/games/{game_id}/play-sessions", response_model=list[PlaySessionResponse])
def list_play_sessions(game_id: int, db: Session = Depends(get_db)) -> list[PlaySessionResponse]:
    sessions = progress_service.list_play_sessions(db, game_id)
    return [play_session_from_orm(session) for session in sessions]


@router.post(
    "/api/games/{game_id}/play-sessions", response_model=PlaySessionResponse, status_code=status.HTTP_201_CREATED
)
def create_play_session(
    game_id: int, body: PlaySessionCreateRequest, db: Session = Depends(get_db)
) -> PlaySessionResponse:
    session = progress_service.create_play_session(db, game_id, **body.model_dump())
    return play_session_from_orm(session)


@router.put("/api/play-sessions/{session_id}", response_model=PlaySessionResponse)
def update_play_session(
    session_id: int, body: PlaySessionUpdateRequest, db: Session = Depends(get_db)
) -> PlaySessionResponse:
    session = progress_service.update_play_session(db, session_id, **body.model_dump(exclude_unset=True))
    return play_session_from_orm(session)


@router.delete("/api/play-sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_play_session(session_id: int, db: Session = Depends(get_db)) -> None:
    progress_service.delete_play_session(db, session_id)
