"""Manual add-on links: an add-on linked by hand to more games than its IGDB parent, e.g. an
FH5 car pack IGDB lists under the Standard edition only, linked to the Premium edition too.

Kept apart from IGDB's own link (Game.parent_game_id) on purpose: nothing here changes it,
and nothing IGDB-driven (import, resync, the bulk jobs) reads or writes the links. A link
works the same from either side: from an add-on's page you link it to games, from a game's
page you link add-ons to it."""

import logging
from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy.orm import Session

from app.models.catalog import Game
from app.repositories import game_repository, toys_to_life_repository
from app.repositories.game_repository import GameWithStatus
from app.services import game_service
from app.services.exceptions import ConflictError, NotFoundError
from app.services.game_service import HIERARCHICAL_ADDON_CATEGORIES
from app.services.igdb_client import IGDBClient

logger = logging.getLogger(__name__)

ADDON_CATEGORIES = set(HIERARCHICAL_ADDON_CATEGORIES)

# The 409 detail when unlinking would leave an add-on attached to nothing; the frontend
# offers to delete the add-on instead.
LAST_LINK_ORPHAN = "last_link_orphan"


@dataclass
class LinkCandidate:
    status: GameWithStatus
    # Shares a Collection with the game; otherwise only a Franchise (UI "Series").
    same_collection: bool
    linked: bool


def is_addon(game: Game) -> bool:
    return game.category in ADDON_CATEGORIES


def _game(db: Session, game_id: int) -> Game:
    game = db.get(Game, game_id)
    if game is None:
        raise NotFoundError(f"Game {game_id} not found")
    return game


def list_works_with(db: Session, game_id: int) -> list[GameWithStatus]:
    """An add-on's games: its IGDB parent first, then the ones it's manually linked to.
    Empty for anything that isn't an add-on."""
    game = _game(db, game_id)
    return game_repository.list_works_with(db, game) if is_addon(game) else []


def list_candidates(db: Session, game_id: int, search: str | None = None) -> list[LinkCandidate]:
    game = _game(db, game_id)
    linked = game_repository.linked_ids(db, game.id, addon_side=is_addon(game))
    return [
        LinkCandidate(status=status, same_collection=same_collection, linked=status.game.id in linked)
        for status, same_collection in game_repository.list_link_candidates(
            db, game, addon_categories=ADDON_CATEGORIES, search=search
        )
    ]


def _pair(addon: Game, game: Game) -> tuple[int, int]:
    """Validates one link and returns it as (addon_game_id, game_id)."""
    if not is_addon(addon):
        raise ConflictError(f"{addon.name} isn't an add-on, so it can't be linked to a game")
    if is_addon(game):
        raise ConflictError(f"{game.name} is an add-on; add-ons can only be linked to games")
    if addon.id == game.id:
        raise ConflictError("An add-on can't be linked to itself")
    if addon.parent_game_id == game.id:
        raise ConflictError(f"{addon.name} already belongs to {game.name} through IGDB")
    return addon.id, game.id


def link(db: Session, game_id: int, other_ids: list[int]) -> int:
    """Links game_id to each of other_ids: games when game_id is an add-on, add-ons when it's
    a game. Already-linked pairs are skipped. All or nothing: one invalid id links none.
    Returns how many links are new."""
    game = _game(db, game_id)
    pairs = []
    for other_id in dict.fromkeys(other_ids):
        other = _game(db, other_id)
        pairs.append(_pair(game, other) if is_addon(game) else _pair(other, game))
    added = game_repository.add_addon_links(db, pairs)
    db.commit()
    return added


def unlink(db: Session, game_id: int, other_id: int) -> None:
    """Removes the link between game_id and other_id, whichever of the two is the add-on.
    Refused (LAST_LINK_ORPHAN) when it's the add-on's last link and it has no IGDB parent in
    your library: it would then show up nowhere."""
    game = _game(db, game_id)
    other = _game(db, other_id)
    addon, target = (game, other) if is_addon(game) else (other, game)
    remaining = game_repository.linked_ids(db, addon.id, addon_side=True)
    if target.id not in remaining:
        raise NotFoundError(f"{addon.name} isn't linked to {target.name}")
    if addon.parent_game_id is None and remaining == {target.id}:
        raise ConflictError(LAST_LINK_ORPHAN)
    game_repository.remove_addon_link(db, addon.id, target.id)
    db.commit()


def list_all(db: Session) -> list[tuple[Game, Game]]:
    """Every manual link as (add-on, game), for Settings → Linked Add-ons."""
    return game_repository.list_all_addon_links(db)


def kept_addons_on_delete(db: Session, game_id: int) -> list[Game]:
    """The add-ons deleting this game would keep, detached, because a manual link to another
    game holds them — for the Remove Game confirmation."""
    _game(db, game_id)
    removal = game_repository.plan_addon_removal(db, game_id)
    return [_game(db, addon_id) for addon_id in removal.kept_ids]


# --- Add-ons from the base game -------------------------------------------------------------
# An edition (e.g. FH5 Premium) only gets the add-ons IGDB lists under it, and IGDB lists most
# of them under the base game (FH5) instead. These offer the base game's add-ons, read live
# from IGDB through the edition's version_parent, and import only the ones picked, linked to
# the edition. The base game itself is never imported.


@dataclass
class BaseGameAddon:
    payload: dict[str, Any]
    local: Game | None
    linked: bool


@dataclass
class BaseGameAddons:
    # IGDB's {id, name, slug, url} for the base game; None when IGDB doesn't record one.
    base_game: dict[str, Any] | None
    base_game_local: Game | None
    addons: list[BaseGameAddon]


@dataclass
class BaseGameAddonResult:
    igdb_id: int
    status: Literal["linked", "already_linked", "failed"]
    game_id: int | None = None


def _edition(db: Session, game_id: int) -> Game | None:
    """The game, when it can have a base game on IGDB: imported from IGDB and not an add-on."""
    game = _game(db, game_id)
    return game if game.igdb_id is not None and not is_addon(game) else None


async def _base_game_payloads(
    db: Session, igdb_client: IGDBClient, game: Game
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    assert game.igdb_id is not None
    base = await igdb_client.get_version_parent(game.igdb_id)
    if base is None:
        return None, []
    addons = await igdb_client.get_addons_by_parent_igdb_id_cached(base["id"])
    # A Toys-to-Life pack has its own page (see import_game_from_igdb).
    pack_ids = toys_to_life_repository.pack_igdb_ids(db)
    return base, [addon for addon in addons if addon.get("id") not in pack_ids]


async def list_base_game_addons(db: Session, igdb_client: IGDBClient, game_id: int) -> BaseGameAddons:
    game = _edition(db, game_id)
    if game is None:
        return BaseGameAddons(base_game=None, base_game_local=None, addons=[])
    base, payloads = await _base_game_payloads(db, igdb_client, game)
    if base is None:
        return BaseGameAddons(base_game=None, base_game_local=None, addons=[])
    linked = game_repository.linked_ids(db, game.id, addon_side=False)
    addons = []
    for payload in sorted(payloads, key=lambda addon: (addon.get("name") or "").lower()):
        local = game_repository.get_game_by_igdb_id(db, payload["id"])
        is_linked = local is not None and (local.id in linked or local.parent_game_id == game.id)
        addons.append(BaseGameAddon(payload=payload, local=local, linked=is_linked))
    return BaseGameAddons(
        base_game=base, base_game_local=game_repository.get_game_by_igdb_id(db, base["id"]), addons=addons
    )


async def link_base_game_addons(
    db: Session, igdb_client: IGDBClient, game_id: int, igdb_ids: list[int]
) -> list[BaseGameAddonResult]:
    """Links each picked base-game add-on to this edition: one already in the library is just
    linked; any other is imported first (its IGDB parent resolves as usual, so with the base
    game not in the library it has none) and then linked. Each add-on commits on its own, so
    one failure doesn't undo or block the others."""
    game = _edition(db, game_id)
    if game is None:
        raise ConflictError("Only a game imported from IGDB can take add-ons from its base game")
    _base, payloads = await _base_game_payloads(db, igdb_client, game)
    by_id = {payload["id"]: payload for payload in payloads}
    results = []
    for igdb_id in dict.fromkeys(igdb_ids):
        payload = by_id.get(igdb_id)
        if payload is None:
            results.append(BaseGameAddonResult(igdb_id=igdb_id, status="failed"))
            continue
        try:
            addon = game_repository.get_game_by_igdb_id(db, igdb_id)
            if addon is None:
                addon = game_service._upsert_from_igdb_payload(db, payload)
            # Picked on purpose, so it's in the library now even if a Collection resync had
            # only discovered it as Missing.
            addon.auto_discovered = False
            if addon.parent_game_id == game.id:
                results.append(BaseGameAddonResult(igdb_id=igdb_id, status="already_linked", game_id=addon.id))
                db.commit()
                continue
            added = game_repository.add_addon_links(db, [_pair(addon, game)])
            db.commit()
            status: Literal["linked", "already_linked"] = "linked" if added else "already_linked"
            results.append(BaseGameAddonResult(igdb_id=igdb_id, status=status, game_id=addon.id))
        except Exception:
            db.rollback()
            logger.exception("Couldn't link base-game add-on %s to game %s", igdb_id, game_id)
            results.append(BaseGameAddonResult(igdb_id=igdb_id, status="failed"))
    return results
