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

from app.models.catalog import Game, GameCategory
from app.models.library import LibraryItem, LibraryStatus
from app.repositories import game_repository, toys_to_life_repository
from app.repositories.game_repository import AddonRelation, GameWithStatus
from app.services import game_service, library_service
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
    # The edition of the same game it's for (an add-on candidate); None for a game candidate.
    edition: Game | None
    linked: bool
    # How an already-linked one goes with this game.
    relation: AddonRelation = "works_with"


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
    """What the link picker offers, from the other editions of the same game (see
    game_repository.list_link_candidates); already-linked ones are flagged."""
    game = _game(db, game_id)
    addon_side = is_addon(game)
    linked = game_repository.linked_ids(db, game.id, addon_side=addon_side)
    relations = game_repository.relation_map(db, game.id, addon_side=addon_side)
    return [
        LinkCandidate(
            status=status,
            edition=edition,
            linked=status.game.id in linked,
            relation=relations.get(status.game.id, "works_with") if status.game.id in linked else "works_with",
        )
        for status, edition in game_repository.list_link_candidates(db, game, is_addon=addon_side, search=search)
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


def link(
    db: Session,
    game_id: int,
    other_ids: list[int],
    included_ids: list[int] | None = None,
    preorder_bonus_ids: list[int] | None = None,
) -> int:
    """Links game_id to each of other_ids: games when game_id is an add-on, add-ons when it's
    a game. The ones in included_ids are marked Included (the add-on is part of that game), the
    ones in preorder_bonus_ids a pre-order bonus for it (Included wins if in both).
    Already-linked pairs are kept, gaining the mark if asked. All or nothing: one invalid id
    links none. Returns how many links are new."""
    game = _game(db, game_id)
    pairs = []
    relations: dict[tuple[int, int], AddonRelation] = {}
    for other_id in dict.fromkeys(other_ids):
        other = _game(db, other_id)
        pair = _pair(game, other) if is_addon(game) else _pair(other, game)
        pairs.append(pair)
        relations[pair] = _wanted_relation(other_id, included_ids, preorder_bonus_ids)
    added = game_repository.add_addon_links(db, pairs, relations)
    db.commit()
    return added


def _wanted_relation(key: int, included: list[int] | None, preorder_bonus: list[int] | None) -> AddonRelation:
    if key in (included or ()):
        return "included"
    return "preorder_bonus" if key in (preorder_bonus or ()) else "works_with"


def set_relation(db: Session, game_id: int, other_id: int, relation: AddonRelation) -> None:
    """Sets how the add-on (whichever of the two it is) goes with the other game: works with
    it, Included in it, or a pre-order bonus for it. Works on a manual link and on the add-on's
    own IGDB parent (whose row then only holds the mark); any other pair isn't linked, so 404."""
    game = _game(db, game_id)
    other = _game(db, other_id)
    addon, target = (game, other) if is_addon(game) else (other, game)
    if not is_addon(addon) or is_addon(target):
        raise ConflictError("Only an add-on's relation to a game can be set")
    is_parent = addon.parent_game_id == target.id
    if not is_parent and target.id not in game_repository.linked_ids(db, addon.id, addon_side=True):
        raise NotFoundError(f"{addon.name} isn't linked to {target.name}")
    game_repository.set_addon_relation(db, addon.id, target.id, relation, keep_row=not is_parent)
    db.commit()


def preorder_bonus_for(db: Session, game_id: int) -> list[Game]:
    """The games this add-on is a pre-order bonus for (empty with the lab off)."""
    return game_repository.preorder_bonus_for(db, game_id)


# The 409 detail when "I got it" can't tell which copy of the game the bonus came with.
CHOOSE_COPY = "choose_copy"


def claim_preorder_bonus(db: Session, addon_id: int, game_id: int) -> LibraryItem:
    """I got it: adds an owned copy of a pre-order bonus, on the platform, region and format of
    your one owned copy of the game it's a bonus for. With no copy or several, CHOOSE_COPY: the
    page opens the usual add-copy dialog instead."""
    addon = _game(db, addon_id)
    game = _game(db, game_id)
    if game_repository.relation_map(db, addon.id, addon_side=True).get(game.id) != "preorder_bonus":
        raise NotFoundError(f"{addon.name} isn't a pre-order bonus for {game.name}")
    copies = library_service.list_library_items(db, game.id, LibraryStatus.OWNED)
    if len(copies) != 1:
        raise ConflictError(CHOOSE_COPY)
    [copy] = copies
    return library_service.add_library_item(
        db,
        addon.id,
        status=LibraryStatus.OWNED,
        platform_id=copy.platform_id,
        region_id=copy.region_id,
        format=copy.format,
        digital_storefront=copy.digital_storefront,
    )


def owned_via(db: Session, game_id: int) -> list[Game]:
    """What this add-on is Included in that counts as owned (empty with the lab off)."""
    return game_repository.owned_via(db, game_id)


def wishlisted_via(db: Session, game_id: int) -> list[Game]:
    """The wishlisted packs this add-on is inside (empty when owned, or with the lab off)."""
    return game_repository.wishlisted_via(db, game_id)


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


def list_all(db: Session) -> list[game_repository.AddonLinkRow]:
    """Every link and Included mark, for Settings → Linked Add-ons."""
    return game_repository.list_all_addon_links(db)


def kept_addons_on_delete(db: Session, game_id: int) -> list[Game]:
    """The add-ons deleting this game would keep, detached, because a manual link to another
    game holds them — for the Remove Game confirmation."""
    _game(db, game_id)
    removal = game_repository.plan_addon_removal(db, game_id)
    return [_game(db, addon_id) for addon_id in removal.kept_ids]


# --- Packs ----------------------------------------------------------------------------------
# IGDB leaves out Season Passes and Ultimate Packs (they'd repeat the add-ons they bundle), so
# they're custom add-ons with the Pack category, holding other add-ons. A pack's page manages
# its contents; any other add-on's page manages the packs it's in. The add-on is Included in
# the pack, so owning the pack (or a game the pack is Included in) owns it too.


@dataclass
class PackCandidate:
    status: GameWithStatus
    # The edition of the same game it's for.
    edition: Game | None
    linked: bool


def is_pack(game: Game) -> bool:
    return game.category == GameCategory.PACK


def list_pack_contents(db: Session, game_id: int) -> list[GameWithStatus]:
    """A pack's contents (any add-on can still hold some after a category change)."""
    game = _game(db, game_id)
    return game_repository.list_pack_contents(db, game.id) if is_addon(game) else []


def list_packs(db: Session, game_id: int) -> list[GameWithStatus]:
    """The packs an add-on is inside."""
    game = _game(db, game_id)
    return game_repository.list_packs_of(db, game.id) if is_addon(game) else []


def list_pack_candidates(db: Session, game_id: int, search: str | None = None) -> list[PackCandidate]:
    """On a pack: add-ons to put inside it. On any other add-on: packs to put it in. Anything
    that would make a loop (a pack inside its own contents) is left out."""
    game = _game(db, game_id)
    if not is_addon(game):
        return []
    on_pack = is_pack(game)
    if on_pack:
        current = game_repository.pack_content_ids(db, game.id)
        excluded = game_repository.pack_ancestors(db, game.id)
    else:
        current = game_repository.pack_ids_of(db, game.id)
        excluded = game_repository.pack_descendants(db, game.id)
    return [
        PackCandidate(status=status, edition=edition, linked=status.game.id in current)
        for status, edition in game_repository.list_pack_candidates(db, game, packs=not on_pack, search=search)
        if status.game.id not in excluded
    ]


def _pack_pair(db: Session, pack: Game, addon: Game) -> tuple[int, int]:
    """Validates putting addon inside pack; returns it as (addon_game_id, pack id)."""
    if not is_pack(pack):
        raise ConflictError(f"{pack.name} isn't a pack, so nothing can be put inside it")
    if not is_addon(addon):
        raise ConflictError(f"{addon.name} isn't an add-on, so it can't be put inside a pack")
    if addon.id == pack.id:
        raise ConflictError("A pack can't be put inside itself")
    if pack.id in game_repository.pack_descendants(db, addon.id):
        raise ConflictError(f"{pack.name} is already inside {addon.name}")
    return addon.id, pack.id


def add_pack_links(db: Session, game_id: int, other_ids: list[int]) -> int:
    """On a pack, puts each of other_ids inside it; on any other add-on, puts it inside each
    of other_ids (packs). All or nothing. Returns how many are new."""
    game = _game(db, game_id)
    if not is_addon(game):
        raise ConflictError(f"{game.name} isn't an add-on")
    pairs = []
    for other_id in dict.fromkeys(other_ids):
        other = _game(db, other_id)
        pairs.append(_pack_pair(db, game, other) if is_pack(game) else _pack_pair(db, other, game))
    added = game_repository.add_addon_links(db, pairs, dict.fromkeys(pairs, "included"))
    db.commit()
    return added


def remove_from_pack(db: Session, pack_id: int, addon_id: int) -> None:
    """Takes an add-on out of a pack. Refused (LAST_LINK_ORPHAN) when it's all that holds an
    add-on with no IGDB parent here, which would then show up nowhere."""
    pack = _game(db, pack_id)
    addon = _game(db, addon_id)
    if pack.id not in game_repository.pack_ids_of(db, addon.id):
        raise NotFoundError(f"{addon.name} isn't inside {pack.name}")
    if addon.parent_game_id is None and game_repository.linked_ids(db, addon.id, addon_side=True) == {pack.id}:
        raise ConflictError(LAST_LINK_ORPHAN)
    game_repository.remove_addon_link(db, addon.id, pack.id)
    db.commit()


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
    # How it already goes with this edition.
    relation: AddonRelation
    # IGDB lists it in this edition's bundle contents, so the picker starts it as Included.
    suggested_included: bool


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


async def _base_game(db: Session, igdb_client: IGDBClient, game: Game) -> dict[str, Any] | None:
    """The edition's base game as IGDB's {id, name, slug, url}: from the library when VGT
    already knows it (version_parent stored, base game imported), else asked of IGDB (cached)."""
    if game.version_parent_checked:
        if game.version_parent_igdb_id is None:
            return None
        local = game_repository.get_game_by_igdb_id(db, game.version_parent_igdb_id)
        if local is not None:
            return {"id": local.igdb_id, "name": local.name, "slug": local.slug, "url": local.igdb_url}
    assert game.igdb_id is not None
    return await igdb_client.get_version_parent(game.igdb_id)


async def _base_game_payloads(
    db: Session, igdb_client: IGDBClient, game: Game
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    base = await _base_game(db, igdb_client, game)
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
    relations = game_repository.relation_map(db, game.id, addon_side=False)
    local_by_igdb = game_repository.games_by_igdb_ids(db, [payload["id"] for payload in payloads])
    addons = []
    for payload in sorted(payloads, key=lambda addon: (addon.get("name") or "").lower()):
        local = local_by_igdb.get(payload["id"])
        is_linked = local is not None and (local.id in linked or local.parent_game_id == game.id)
        # `fields *` returns an add-on's bundles as bare ids: the bundles (editions) it's part of.
        in_bundle = game.igdb_id in (payload.get("bundles") or [])
        addons.append(
            BaseGameAddon(
                payload=payload,
                local=local,
                linked=is_linked,
                relation=relations.get(local.id, "works_with") if local is not None else "works_with",
                suggested_included=in_bundle,
            )
        )
    return BaseGameAddons(
        base_game=base, base_game_local=game_repository.get_game_by_igdb_id(db, base["id"]), addons=addons
    )


async def link_base_game_addons(
    db: Session,
    igdb_client: IGDBClient,
    game_id: int,
    igdb_ids: list[int],
    included_igdb_ids: list[int] | None = None,
    preorder_bonus_igdb_ids: list[int] | None = None,
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
            relation = _wanted_relation(igdb_id, included_igdb_ids, preorder_bonus_igdb_ids)
            if addon.parent_game_id == game.id:
                if relation != "works_with":
                    game_repository.set_addon_relation(db, addon.id, game.id, relation, keep_row=False)
                results.append(BaseGameAddonResult(igdb_id=igdb_id, status="already_linked", game_id=addon.id))
                db.commit()
                continue
            pair = _pair(addon, game)
            added = game_repository.add_addon_links(db, [pair], {pair: relation})
            db.commit()
            status: Literal["linked", "already_linked"] = "linked" if added else "already_linked"
            results.append(BaseGameAddonResult(igdb_id=igdb_id, status=status, game_id=addon.id))
        except Exception:
            db.rollback()
            logger.exception("Couldn't link base-game add-on %s to game %s", igdb_id, game_id)
            results.append(BaseGameAddonResult(igdb_id=igdb_id, status="failed"))
    return results
