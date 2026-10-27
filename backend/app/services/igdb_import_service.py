"""IGDB Import: matches custom games (added by hand, no igdb_id) to IGDB by name and links
them — one at a time or in bulk — through the same paths as a game page's Link to IGDB.
The Find matches and bulk Link jobs that use this live in igdb_import_jobs.py."""

import enum
import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.catalog import Game, GameCategory
from app.models.igdb_import import IgdbImportEntry
from app.repositories import game_repository
from app.repositories.game_repository import GameWithStatus
from app.services import game_service
from app.services.exceptions import ConflictError, NotFoundError
from app.services.igdb_client import IGDBClient

# What Link to IGDB lets a custom game or addon link to (frontend LinkToIgdbDialog's
# GAME_TYPE_CATEGORIES / ADDON_TYPE_CATEGORIES) — a match outside these isn't offered.
LINKABLE_GAME_CATEGORIES = {
    GameCategory.MAIN_GAME,
    GameCategory.STANDALONE_EXPANSION,
    GameCategory.EXPANDED_GAME,
    GameCategory.BUNDLE,
    GameCategory.REMASTER,
}
LINKABLE_ADDON_CATEGORIES = game_service.HIERARCHICAL_ADDON_CATEGORIES


class IgdbImportStatus(enum.Enum):
    NOT_CHECKED = "not_checked"
    MATCH_FOUND = "match_found"
    # The match is a game already in the library: linking merges into it.
    IN_LIBRARY = "in_library"
    SEVERAL_MATCHES = "several_matches"
    NO_MATCH = "no_match"
    IGNORED = "ignored"


# What Link selected (and the per-row Link) can act on without the user picking a game.
LINKABLE_STATUSES = {IgdbImportStatus.MATCH_FOUND, IgdbImportStatus.IN_LIBRARY}


def normalize_name(name: str) -> str:
    """A name as compared for a match: case, accents and symbols ignored, so "Stage Tour",
    "stage tour", "Stage Tour™" and "Stage Tour!" are all the same name."""
    # Trademark-style marks first: NFKD would spell ™ out as the letters "TM".
    text = re.sub(r"[™®©℠]", " ", name)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower().replace("&", " and ")
    text = re.sub(r"[^\w\s]|_", " ", text)
    return " ".join(text.split())


def _release_year(timestamp: int | None) -> int | None:
    return datetime.fromtimestamp(timestamp, tz=UTC).year if timestamp is not None else None


def pick_match(game: Game, candidates: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, int]:
    """The IGDB result to link `game` to, and how many results matched its name exactly.
    Only linkable kinds count (games for a game, addons for an addon). Several exact matches
    (remakes, re-releases) are narrowed to the game's own release year when it has one;
    otherwise there's no pick and the user chooses."""
    linkable = LINKABLE_ADDON_CATEGORIES if game.category in LINKABLE_ADDON_CATEGORIES else LINKABLE_GAME_CATEGORIES
    wanted = normalize_name(game.name)
    exact = [
        candidate
        for candidate in candidates
        if normalize_name(candidate.get("name") or "") == wanted
        and game_service.resolve_igdb_category(candidate)[1] in linkable
    ]
    if len(exact) == 1:
        return exact[0], 1
    year = _release_year(game.first_release_date)
    if len(exact) > 1 and year is not None:
        same_year = [candidate for candidate in exact if _release_year(candidate.get("first_release_date")) == year]
        if len(same_year) == 1:
            return same_year[0], len(exact)
    return None, len(exact)


def record_match(db: Session, game: Game, candidates: list[dict[str, Any]]) -> IgdbImportEntry:
    """Stores what Find matches found for `game` (its match, or none), keeping the entry's
    ignored/queued bookkeeping."""
    entry = get_entry(db, game.id)
    if entry is None:
        entry = IgdbImportEntry(game_id=game.id)
        db.add(entry)
    match, exact_count = pick_match(game, candidates)
    parent = match.get("parent_game") if match else None
    entry.match_igdb_id = match["id"] if match else None
    entry.match_name = match.get("name") if match else None
    entry.match_cover_url = match.get("cover_url") if match else None
    entry.match_first_release_date = match.get("first_release_date") if match else None
    entry.match_category = game_service.resolve_igdb_category(match)[1] if match else None
    entry.match_parent_igdb_id = parent.get("id") if isinstance(parent, dict) else None
    entry.exact_match_count = exact_count
    entry.checked_at = datetime.now(UTC)
    return entry


def list_custom_games(db: Session) -> list[Game]:
    """Every game added by hand and not linked to IGDB yet — not the ones a Collection/Series
    resync discovered, which come from IGDB already."""
    return list(
        db.scalars(select(Game).where(Game.igdb_id.is_(None), Game.auto_discovered.is_(False)).order_by(Game.name))
    )


@dataclass
class IgdbImportRow:
    game: Game
    entry: IgdbImportEntry | None
    status: IgdbImportStatus
    # The game already in the library that the match is (IN_LIBRARY), if any.
    library_game: Game | None


def _status(db: Session, entry: IgdbImportEntry | None) -> tuple[IgdbImportStatus, Game | None]:
    if entry is None or entry.checked_at is None:
        return (IgdbImportStatus.IGNORED if entry and entry.dismissed else IgdbImportStatus.NOT_CHECKED), None
    if entry.dismissed:
        return IgdbImportStatus.IGNORED, None
    if entry.match_igdb_id is None:
        status = IgdbImportStatus.SEVERAL_MATCHES if entry.exact_match_count > 1 else IgdbImportStatus.NO_MATCH
        return status, None
    existing = game_repository.get_game_by_igdb_id(db, entry.match_igdb_id)
    return (IgdbImportStatus.IN_LIBRARY, existing) if existing else (IgdbImportStatus.MATCH_FOUND, None)


def list_rows(db: Session) -> list[IgdbImportRow]:
    games = list_custom_games(db)
    entries = {
        entry.game_id: entry
        for entry in db.scalars(select(IgdbImportEntry).where(IgdbImportEntry.game_id.in_([g.id for g in games])))
    }
    rows = []
    for game in games:
        entry = entries.get(game.id)
        status, library_game = _status(db, entry)
        rows.append(IgdbImportRow(game=game, entry=entry, status=status, library_game=library_game))
    return rows


def get_entry(db: Session, game_id: int) -> IgdbImportEntry | None:
    return db.scalars(select(IgdbImportEntry).where(IgdbImportEntry.game_id == game_id)).first()


def game_name(db: Session, game_id: int) -> str:
    game = db.get(Game, game_id)
    return game.name if game else f"Game {game_id}"


def _custom_game_with_entry(db: Session, game_id: int) -> tuple[Game, IgdbImportEntry | None]:
    game = db.get(Game, game_id)
    if game is None:
        raise NotFoundError(f"Game {game_id} not found")
    if game.igdb_id is not None or game.auto_discovered:
        raise ConflictError(f"Game {game_id} isn't a custom game")
    return game, get_entry(db, game_id)


def set_ignored(db: Session, game_ids: list[int], ignored: bool) -> int:
    """Ignore (or un-ignore) these custom games on IGDB Import; returns how many changed."""
    changed = 0
    for game_id in game_ids:
        game, entry = _custom_game_with_entry(db, game_id)
        if entry is None:
            entry = IgdbImportEntry(game_id=game.id)
            db.add(entry)
        if entry.dismissed != ignored:
            entry.dismissed = ignored
            entry.queued = False
            changed += 1
    db.commit()
    return changed


async def link_entry(db: Session, igdb_client: IGDBClient, game_id: int) -> GameWithStatus:
    """Links a custom game to its IGDB Import match the way Link to IGDB would: merges into
    the match when it's already in the library, imports an addon match's parent first when
    that isn't, and links in place otherwise (which marks it linked_from_custom)."""
    game, entry = _custom_game_with_entry(db, game_id)
    status, library_game = _status(db, entry)
    if entry is None or status not in LINKABLE_STATUSES:
        raise ConflictError(f"Game {game_id} has no IGDB match to link to")

    igdb_id = entry.match_igdb_id
    assert igdb_id is not None
    if library_game is not None:
        result = game_service.merge_duplicate_game(db, game.id, igdb_id)
    elif (
        entry.match_category in LINKABLE_ADDON_CATEGORIES
        and entry.match_parent_igdb_id is not None
        and game_repository.get_game_by_igdb_id(db, entry.match_parent_igdb_id) is None
    ):
        result = await game_service.link_addon_via_new_parent(db, igdb_client, game.id, igdb_id)
    else:
        result = await game_service.link_game_to_igdb(db, igdb_client, game.id, igdb_id)

    # The game is linked (or merged away) now, so it's no longer on IGDB Import.
    db.execute(delete(IgdbImportEntry).where(IgdbImportEntry.game_id == game_id))
    db.commit()
    return result


def queue_for_linking(db: Session, game_ids: list[int]) -> int:
    """Marks these games' matches for the bulk Link job; returns how many can be linked."""
    queued = 0
    for game_id in game_ids:
        _game, entry = _custom_game_with_entry(db, game_id)
        status, _library_game = _status(db, entry)
        if entry is not None and status in LINKABLE_STATUSES:
            entry.queued = True
            queued += 1
    db.commit()
    return queued


def list_queued_game_ids(db: Session) -> list[int]:
    return list(db.scalars(select(IgdbImportEntry.game_id).where(IgdbImportEntry.queued.is_(True))))


def unqueue(db: Session, game_id: int) -> None:
    entry = get_entry(db, game_id)
    if entry is not None:
        entry.queued = False
        db.commit()
