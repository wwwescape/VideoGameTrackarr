"""The Game Shelf's game cases (Settings > Game Cases): which platforms have a standard case,
whether each is shown on the shelf, and which case a platform's games are drawn in.

A case belongs to every platform row whose IGDB slug matches it once IGDB's "--N" suffix is
dropped, so "ps4" and "ps4--1" share the PS4 case."""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.catalog import Game, Platform
from app.models.game_cases import GameCase
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.repositories.game_repository import _is_browsable_game
from app.services.exceptions import NotFoundError
from app.services.game_case_catalog import bare_slug


@dataclass
class GameCaseRow:
    case: GameCase
    # Top-level games you own a physical copy of on this case's platform(s).
    physical_games: int
    # From the matching platform: its short name and IGDB logo.
    abbreviation: str | None
    logo_url: str | None


def _physical_game_ids_by_slug(db: Session) -> dict[str, set[int]]:
    rows = db.execute(
        select(Platform.slug, LibraryItem.game_id)
        .join(Platform, Platform.id == LibraryItem.platform_id)
        .join(Game, Game.id == LibraryItem.game_id)
        .where(
            LibraryItem.status == LibraryStatus.OWNED,
            LibraryItem.format == MediaFormat.PHYSICAL,
            Game.parent_game_id.is_(None),
            _is_browsable_game(Game.category),
        )
        .distinct()
    )
    games: dict[str, set[int]] = {}
    for slug, game_id in rows:
        key = bare_slug(slug)
        if key:
            games.setdefault(key, set()).add(game_id)
    return games


def _platform_details_by_slug(db: Session) -> dict[str, tuple[str | None, str | None]]:
    """(abbreviation, IGDB logo) per case slug, from the first matching platform that has each."""
    details: dict[str, tuple[str | None, str | None]] = {}
    for slug, abbreviation, logo_url in db.execute(
        select(Platform.slug, Platform.abbreviation, Platform.logo_url).order_by(Platform.id)
    ):
        key = bare_slug(slug)
        if not key:
            continue
        known_abbreviation, known_logo = details.get(key, (None, None))
        details[key] = (known_abbreviation or abbreviation, known_logo or logo_url)
    return details


def list_cases(db: Session) -> list[GameCaseRow]:
    """Every predefined case, by platform name."""
    games = _physical_game_ids_by_slug(db)
    details = _platform_details_by_slug(db)
    cases = db.scalars(select(GameCase).order_by(GameCase.platform_name))
    return [
        GameCaseRow(case, len(games.get(case.platform_slug, ())), *details.get(case.platform_slug, (None, None)))
        for case in cases
    ]


def get_case_row(db: Session, case_id: int) -> GameCaseRow:
    for row in list_cases(db):
        if row.case.id == case_id:
            return row
    raise NotFoundError(f"Game case {case_id} not found")


def set_shown(db: Session, case_id: int, shown: bool) -> GameCaseRow:
    case = db.get(GameCase, case_id)
    if case is None:
        raise NotFoundError(f"Game case {case_id} not found")
    case.shown = shown
    db.commit()
    return get_case_row(db, case_id)


def shown_cases_by_platform(db: Session, platform_ids: list[int] | None = None) -> dict[int, GameCase]:
    """The shown case of each platform that has one (all platforms, or just these)."""
    cases = {case.platform_slug: case for case in db.scalars(select(GameCase).where(GameCase.shown.is_(True)))}
    stmt = select(Platform.id, Platform.slug)
    if platform_ids is not None:
        stmt = stmt.where(Platform.id.in_(platform_ids))
    result: dict[int, GameCase] = {}
    for platform_id, slug in db.execute(stmt):
        case = cases.get(bare_slug(slug) or "")
        if case is not None:
            result[platform_id] = case
    return result
