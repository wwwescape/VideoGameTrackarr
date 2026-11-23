from typing import Literal

from pydantic import Field

from app.models.catalog import Game, GameCategory
from app.repositories.game_repository import AddonRelation
from app.schemas.base import CamelModel
from app.schemas.game import GameRefResponse, GameSummaryResponse, game_ref_from_orm, game_summary_from_orm
from app.services import game_service
from app.services.addon_link_service import BaseGameAddonResult, BaseGameAddons, LinkCandidate, PackCandidate


class AddonLinkCandidateResponse(GameSummaryResponse):
    # The edition of the same game an add-on candidate is for (the picker groups by it); null
    # for a game candidate.
    edition: GameRefResponse | None
    # Already linked: shown checked and disabled.
    linked: bool
    # How an already-linked one goes with it (summary's `included`/`preorderBonus` are about a
    # list's own game, not this).
    linked_relation: AddonRelation


def addon_link_candidate_from(candidate: LinkCandidate) -> AddonLinkCandidateResponse:
    summary = game_summary_from_orm(candidate.status)
    return AddonLinkCandidateResponse(
        **summary.model_dump(),
        edition=game_ref_from_orm(candidate.edition) if candidate.edition else None,
        linked=candidate.linked,
        linked_relation=candidate.relation,
    )


class PackCandidateResponse(GameSummaryResponse):
    # The edition of the same game it's for; the picker groups by it.
    edition: GameRefResponse | None
    # Already inside (or already holding) it: shown checked and disabled.
    linked: bool


def pack_candidate_from(candidate: PackCandidate) -> PackCandidateResponse:
    summary = game_summary_from_orm(candidate.status)
    return PackCandidateResponse(
        **summary.model_dump(),
        edition=game_ref_from_orm(candidate.edition) if candidate.edition else None,
        linked=candidate.linked,
    )


class PackLinkRequest(CamelModel):
    # On a pack: add-ons to put inside it. On any other add-on: packs to put it in.
    ids: list[int] = Field(min_length=1, max_length=100)


class AddonLinkRequest(CamelModel):
    # Games when linking from an add-on, add-ons when linking from a game.
    ids: list[int] = Field(min_length=1, max_length=100)
    # The ones among ids to mark Included (the add-on is part of that game).
    included_ids: list[int] = Field(default_factory=list, max_length=100)
    # The ones among ids to mark a pre-order bonus for that game.
    preorder_bonus_ids: list[int] = Field(default_factory=list, max_length=100)


class AddonRelationRequest(CamelModel):
    relation: AddonRelation


class AddonLinkResponse(CamelModel):
    added: int


class AddonRefResponse(CamelModel):
    id: int
    uuid: str
    slug: str | None
    name: str


def addon_ref_from_orm(game: Game) -> AddonRefResponse:
    return AddonRefResponse(id=game.id, uuid=game.uuid, slug=game.slug, name=game.name)


class AddonLinkPairResponse(CamelModel):
    addon: AddonRefResponse
    game: AddonRefResponse
    relation: AddonRelation
    # False for the add-on's own IGDB parent: only a mark, nothing to unlink.
    manual: bool
    # The "game" is a pack the add-on is inside (always Included).
    pack: bool = False


class GameRemovalPreviewResponse(CamelModel):
    # Add-ons that deleting the game keeps, detached, because a manual link holds them.
    kept_addons: list[AddonRefResponse]


class BaseGameRefResponse(CamelModel):
    igdb_id: int
    name: str
    # Its local id when it's in the library too (the picker can link to its page).
    game_id: int | None


class BaseGameAddonResponse(CamelModel):
    igdb_id: int
    name: str
    cover_url: str | None
    category: GameCategory | None
    first_release_date: int | None
    # Already in VGT (its local id); otherwise picking it imports it ("Will be added").
    game_id: int | None
    # Already linked to this game (by hand, or as its IGDB add-on): shown ticked and disabled.
    linked: bool
    # How it already goes with this game.
    relation: AddonRelation
    # IGDB lists it in this game's bundle contents: the picker starts it as Included.
    suggested_included: bool


class BaseGameAddonsResponse(CamelModel):
    # Null when IGDB doesn't record a base game for this one (or it isn't from IGDB).
    base_game: BaseGameRefResponse | None
    addons: list[BaseGameAddonResponse]


def base_game_addons_from(result: BaseGameAddons) -> BaseGameAddonsResponse:
    base = result.base_game
    return BaseGameAddonsResponse(
        base_game=(
            BaseGameRefResponse(
                igdb_id=base["id"],
                name=base.get("name") or "",
                game_id=result.base_game_local.id if result.base_game_local else None,
            )
            if base
            else None
        ),
        addons=[
            BaseGameAddonResponse(
                igdb_id=addon.payload["id"],
                name=addon.payload.get("name") or "",
                cover_url=addon.payload.get("cover_url"),
                category=game_service.resolve_igdb_category(addon.payload)[1],
                first_release_date=addon.payload.get("first_release_date"),
                game_id=addon.local.id if addon.local else None,
                linked=addon.linked,
                relation=addon.relation,
                suggested_included=addon.suggested_included,
            )
            for addon in result.addons
        ],
    )


class BaseGameAddonsLinkRequest(CamelModel):
    igdb_ids: list[int] = Field(min_length=1, max_length=100)
    # The ones among igdb_ids to mark Included in this game.
    included_igdb_ids: list[int] = Field(default_factory=list, max_length=100)
    # The ones among igdb_ids to mark a pre-order bonus for this game.
    preorder_bonus_igdb_ids: list[int] = Field(default_factory=list, max_length=100)


class BaseGameAddonResultResponse(CamelModel):
    igdb_id: int
    status: Literal["linked", "already_linked", "failed"]
    game_id: int | None


class BaseGameAddonsLinkResponse(CamelModel):
    results: list[BaseGameAddonResultResponse]


def base_game_link_results_from(results: list[BaseGameAddonResult]) -> BaseGameAddonsLinkResponse:
    return BaseGameAddonsLinkResponse(
        results=[BaseGameAddonResultResponse(igdb_id=r.igdb_id, status=r.status, game_id=r.game_id) for r in results]
    )
