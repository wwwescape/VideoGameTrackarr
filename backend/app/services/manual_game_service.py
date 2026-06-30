from typing import Any

from sqlalchemy.orm import Session

from app.models.catalog import CompanyRole, Game, GameCategory
from app.repositories import company_repository, game_repository, note_repository, platform_repository
from app.repositories.game_repository import GameWithStatus
from app.services.exceptions import ConflictError, NotFoundError
from app.services.game_service import get_game_detail


def create_manual_game(
    db: Session,
    name: str,
    category: GameCategory,
    first_release_date: int | None,
    summary: str | None,
    storyline: str | None,
    edition: str | None,
    cover_url: str | None,
    parent_game_id: int | None = None,
    developed_by: list[str] | None = None,
    published_by: list[str] | None = None,
    platform_names: list[str] | None = None,
    notes: str | None = None,
) -> GameWithStatus:
    if parent_game_id is not None and db.get(Game, parent_game_id) is None:
        raise NotFoundError(f"Game {parent_game_id} not found")

    game = game_repository.create_manual_game(
        db,
        name=name,
        category=category,
        first_release_date=first_release_date,
        summary=summary,
        storyline=storyline,
        edition=edition,
        cover_url=cover_url,
        parent_game_id=parent_game_id,
    )

    company_roles = [
        (company_repository.get_or_create_by_name(db, company_name).id, CompanyRole.DEVELOPER)
        for company_name in developed_by or []
    ] + [
        (company_repository.get_or_create_by_name(db, company_name).id, CompanyRole.PUBLISHER)
        for company_name in published_by or []
    ]
    if company_roles:
        company_repository.sync_for_game(db, game.id, company_roles)

    platform_ids = [
        platform_repository.get_or_create_by_name(db, platform_name).id for platform_name in platform_names or []
    ]
    if platform_ids:
        platform_repository.sync_for_game(db, game.id, platform_ids)

    if notes:
        note_repository.create_note(db, game.id, notes)

    db.commit()
    return get_game_detail(db, game.id)


def update_manual_game(db: Session, game_id: int, notes: str | None = None, **fields: Any) -> GameWithStatus:
    existing = get_game_detail(db, game_id)
    game = existing.game
    if game.igdb_id is not None:
        raise ConflictError(f"Game {game_id} is linked to IGDB and cannot be edited manually")

    parent_game_id = fields.get("parent_game_id")
    if parent_game_id is not None and db.get(Game, parent_game_id) is None:
        raise NotFoundError(f"Game {parent_game_id} not found")

    developed_by = fields.pop("developed_by", None)
    published_by = fields.pop("published_by", None)
    platform_names = fields.pop("platform_names", None)

    game_repository.update_manual_game(db, game, **fields)

    if developed_by is not None or published_by is not None:
        company_roles = [
            (company_repository.get_or_create_by_name(db, company_name).id, CompanyRole.DEVELOPER)
            for company_name in developed_by or []
        ] + [
            (company_repository.get_or_create_by_name(db, company_name).id, CompanyRole.PUBLISHER)
            for company_name in published_by or []
        ]
        company_repository.sync_for_game(db, game.id, company_roles)

    if platform_names is not None:
        platform_ids = [
            platform_repository.get_or_create_by_name(db, platform_name).id for platform_name in platform_names
        ]
        platform_repository.sync_for_game(db, game.id, platform_ids)

    if notes:
        note_repository.create_note(db, game.id, notes)

    db.commit()
    return get_game_detail(db, game.id)
