from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.repositories import library_item_repository
from app.services import bios_service, emulation_cores


@dataclass(frozen=True)
class GameCardExtras:
    """What the Games list shows beyond a game's own row: the platforms it has copies on, and
    whether one of its owned copies has a ROM the in-browser emulator can run (the card's
    hover Play)."""

    platforms: list[str] = field(default_factory=list)
    playable: bool = False


def get_card_extras(db: Session, game_ids: list[int]) -> dict[int, GameCardExtras]:
    """Two batched queries for the whole page of games rather than one per game."""
    platforms: dict[int, list[str]] = {}
    for game_id, label in library_item_repository.list_copy_platforms(db, game_ids):
        platforms.setdefault(game_id, []).append(label)

    playable: set[int] = set()
    owned_roms = library_item_repository.list_owned_roms(db, game_ids)
    if owned_roms:
        # Resolved the same way as each ROM's own `playable` on the game page
        # (schemas/library.py's rom_summary_from_orm).
        ready_bios = bios_service.ready_systems(db)
        for game_id, platform_slug, rom in owned_roms:
            if game_id in playable:
                continue
            _core, reason = emulation_cores.resolve_playability(
                platform_slug, rom.extension, rom.is_archive, ready_bios
            )
            if reason is None:
                playable.add(game_id)

    return {
        game_id: GameCardExtras(platforms=platforms.get(game_id, []), playable=game_id in playable)
        for game_id in game_ids
    }
