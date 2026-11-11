from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.game_case import GameCaseResponse, GameCaseUpdateRequest, game_case_from_row
from app.services import game_case_service
from app.services.labs import LAB_GAME_SHELF, require_lab

# Settings > Game Cases. Only there while the Game Shelf lab is on.
router = APIRouter(
    tags=["game-cases"], dependencies=[Depends(get_current_user), Depends(require_lab(LAB_GAME_SHELF))]
)


@router.get("/api/game-cases", response_model=list[GameCaseResponse])
def list_game_cases(db: Session = Depends(get_db)) -> list[GameCaseResponse]:
    return [game_case_from_row(row) for row in game_case_service.list_cases(db)]


@router.put("/api/game-cases/{case_id}", response_model=GameCaseResponse)
def update_game_case(case_id: int, body: GameCaseUpdateRequest, db: Session = Depends(get_db)) -> GameCaseResponse:
    return game_case_from_row(game_case_service.set_shown(db, case_id, body.shown))
