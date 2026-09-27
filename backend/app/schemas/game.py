from typing import Any

from app.models.catalog import CompanyRole, Game, GameCategory, IgdbReleaseRegion
from app.models.library import GameProgress, PlayStatus, Tag
from app.repositories.game_repository import GameWithStatus
from app.schemas.base import CamelModel
from app.schemas.catalog import (
    CatalogRefResponse,
    GameCompanyResponse,
    GameVideoResponse,
    ReleaseDateResponse,
    collection_ref_from_orm,
    franchise_ref_from_orm,
    game_company_from_orm,
    game_video_from_orm,
    genre_ref_from_orm,
    release_date_from_orm,
)
from app.schemas.platform import PlatformResponse
from app.schemas.progress import GameProgressResponse, game_progress_from_orm
from app.schemas.tag import TagResponse, tag_from_orm


class GameSummaryResponse(CamelModel):
    id: int
    uuid: str
    igdb_id: int | None
    name: str
    slug: str | None
    cover_url: str | None
    category: GameCategory | None
    first_release_date: int | None
    # Computed fresh per request (EXISTS/scalar-subquery against library_items and
    # game_progress), never a stored counter — see GameWithStatus and the audit's
    # owned/wishlisted-counter finding.
    owned: bool
    wishlisted: bool
    play_status: PlayStatus | None
    rating: float | None
    is_on_sale: bool
    # True only for a game (or addon) that only exists locally because a Collection/Series
    # "what's missing" resync discovered it, and hasn't been claimed since — see
    # Game.auto_discovered's comment. On the summary (not just the detail response) because
    # GameCard needs it wherever a cover renders: it's what tells apart a discovered-but-
    # unclaimed game (greyscale + "Missing" chip) from a manually-added one that just isn't
    # owned/wishlisted yet (greyscale, no chip) — both look identical via owned/wishlisted
    # alone.
    auto_discovered: bool
    steam_store_url: str | None
    xbox_store_url: str | None
    playstation_store_url: str | None
    nintendo_store_url: str | None
    epic_games_store_url: str | None
    gog_store_url: str | None


class GameDetailResponse(GameSummaryResponse):
    summary: str | None
    storyline: str | None
    edition: str | None
    igdb_url: str | None
    steam_app_id: int | None
    parent_game_id: int | None
    parent_game_name: str | None
    parent_game_slug: str | None
    parent_game_uuid: str | None
    display_parent_game_id: int | None
    display_parent_game_name: str | None
    display_parent_game_slug: str | None
    display_parent_game_uuid: str | None
    external_parent_name: str | None
    external_parent_igdb_url: str | None
    progress: GameProgressResponse
    tags: list[TagResponse]
    genres: list[CatalogRefResponse]
    companies: list[GameCompanyResponse]
    franchises: list[CatalogRefResponse]
    collections: list[CatalogRefResponse]
    platforms: list[PlatformResponse]
    screenshot_urls: list[str]
    artwork_urls: list[str]
    videos: list[GameVideoResponse]
    release_dates: list[ReleaseDateResponse]


def _game_fields(game: Game, status: GameWithStatus) -> dict:
    return {
        "id": game.id,
        "uuid": game.uuid,
        "igdb_id": game.igdb_id,
        "name": game.name,
        "slug": game.slug,
        "cover_url": game.cover_url,
        "category": game.category,
        "first_release_date": game.first_release_date,
        "owned": status.owned,
        "wishlisted": status.wishlisted,
        "play_status": status.play_status,
        "rating": status.rating,
        "auto_discovered": game.auto_discovered,
        "steam_store_url": game.steam_store_url,
        "xbox_store_url": game.xbox_store_url,
        "playstation_store_url": game.playstation_store_url,
        "nintendo_store_url": game.nintendo_store_url,
        "epic_games_store_url": game.epic_games_store_url,
        "gog_store_url": game.gog_store_url,
    }


def game_summary_from_orm(
    status: GameWithStatus, on_sale_game_ids: frozenset[int] = frozenset()
) -> GameSummaryResponse:
    return GameSummaryResponse(**_game_fields(status.game, status), is_on_sale=status.game.id in on_sale_game_ids)


def game_detail_from_orm(
    status: GameWithStatus,
    progress: GameProgress | None,
    tags: list[Tag],
    steam_app_id: int | None = None,
    on_sale_game_ids: frozenset[int] = frozenset(),
) -> GameDetailResponse:
    game = status.game
    # parent_game_name comes from the `parent_game` relationship, not a plain column, so
    # this can't just be GameDetailResponse.model_validate(game, from_attributes=True).
    return GameDetailResponse(
        **_game_fields(game, status),
        is_on_sale=game.id in on_sale_game_ids,
        summary=game.summary,
        storyline=game.storyline,
        edition=game.edition,
        igdb_url=game.igdb_url,
        steam_app_id=steam_app_id,
        parent_game_id=game.parent_game_id,
        parent_game_name=game.parent_game.name if game.parent_game else None,
        parent_game_slug=game.parent_game.slug if game.parent_game else None,
        parent_game_uuid=game.parent_game.uuid if game.parent_game else None,
        display_parent_game_id=game.display_parent_game_id,
        display_parent_game_name=game.display_parent_game.name if game.display_parent_game else None,
        display_parent_game_slug=game.display_parent_game.slug if game.display_parent_game else None,
        display_parent_game_uuid=game.display_parent_game.uuid if game.display_parent_game else None,
        external_parent_name=game.external_parent_name,
        external_parent_igdb_url=game.external_parent_igdb_url,
        progress=game_progress_from_orm(game.id, progress),
        tags=[tag_from_orm(tag) for tag in tags],
        genres=[genre_ref_from_orm(gg.genre) for gg in game.genres],
        companies=[game_company_from_orm(gc) for gc in game.companies],
        franchises=[franchise_ref_from_orm(gf.franchise) for gf in game.franchises],
        collections=[collection_ref_from_orm(gcol.collection) for gcol in game.collections],
        platforms=[PlatformResponse.model_validate(gp.platform) for gp in game.platforms],
        screenshot_urls=[s.url for s in game.screenshots],
        artwork_urls=[a.url for a in game.artworks],
        videos=[game_video_from_orm(v) for v in game.videos],
        release_dates=[release_date_from_orm(rd) for rd in game.release_dates],
    )


class GameImportRequest(CamelModel):
    igdb_id: int


class IGDBParentGameResponse(CamelModel):
    igdb_id: int
    name: str


class IGDBSearchResultResponse(CamelModel):
    igdb_id: int
    name: str
    slug: str | None
    summary: str | None
    cover_url: str | None
    category: GameCategory | None
    first_release_date: int | None
    parent_game: IGDBParentGameResponse | None = None


class LocalGameRefResponse(CamelModel):
    slug: str | None
    uuid: str
    name: str


class IgdbGamePreviewResponse(CamelModel):
    """A game straight from IGDB, never persisted — backs the Add Game preview page. Uses the
    same field names/shapes as GameDetailResponse for everything GameAboutSection reads, so
    that section renders it unchanged; nested ids are IGDB's (display keys only — nothing
    here exists locally). Fields with no meaning for a not-yet-added game (parent links to
    local games, rating, edition) are always empty."""

    igdb_id: int
    name: str
    slug: str | None
    cover_url: str | None
    category: GameCategory | None
    first_release_date: int | None
    summary: str | None
    storyline: str | None
    igdb_url: str | None
    edition: None = None
    rating: None = None
    owned: bool = False
    wishlisted: bool = False
    is_on_sale: bool = False
    auto_discovered: bool = False
    parent_game_id: None = None
    parent_game_name: None = None
    parent_game_slug: None = None
    parent_game_uuid: None = None
    display_parent_game_id: None = None
    display_parent_game_name: None = None
    display_parent_game_slug: None = None
    display_parent_game_uuid: None = None
    external_parent_name: str | None
    external_parent_igdb_url: str | None
    genres: list[CatalogRefResponse]
    companies: list[GameCompanyResponse]
    franchises: list[CatalogRefResponse]
    collections: list[CatalogRefResponse]
    platforms: list[PlatformResponse]
    screenshot_urls: list[str]
    artwork_urls: list[str]
    videos: list[GameVideoResponse]
    release_dates: list[ReleaseDateResponse]
    steam_store_url: str | None = None
    xbox_store_url: str | None = None
    playstation_store_url: str | None = None
    nintendo_store_url: str | None = None
    epic_games_store_url: str | None = None
    gog_store_url: str | None = None
    # Set when this IGDB game is already in the local catalog — the page redirects there.
    local_game: LocalGameRefResponse | None = None


_PREVIEW_COMPANY_ROLE_FLAGS = (
    ("developer", CompanyRole.DEVELOPER),
    ("publisher", CompanyRole.PUBLISHER),
    ("porting", CompanyRole.PORTING),
    ("supporting", CompanyRole.SUPPORTING),
)


def _refs(items: list[dict[str, Any]] | None) -> list[CatalogRefResponse]:
    return [
        CatalogRefResponse(id=item["id"], name=item["name"], slug=item.get("slug"))
        for item in items or []
        if item.get("id") is not None and item.get("name")
    ]


def igdb_game_preview_from_payload(
    igdb_game: dict[str, Any],
    category: GameCategory | None,
    store_urls: dict[str, str | None],
    local_game: Game | None,
) -> IgdbGamePreviewResponse:
    companies: dict[tuple[int, CompanyRole], GameCompanyResponse] = {}
    for involved in igdb_game.get("involved_companies") or []:
        company = involved.get("company")
        if not company or company.get("id") is None:
            continue
        for flag, role in _PREVIEW_COMPANY_ROLE_FLAGS:
            if involved.get(flag):
                # Keyed like the import path's set: IGDB can list the same company twice.
                companies[(company["id"], role)] = GameCompanyResponse(
                    id=company["id"],
                    name=company.get("name", ""),
                    slug=company.get("slug"),
                    logo_url=(company.get("logo") or {}).get("url"),
                    role=role,
                )

    parent_ref = igdb_game.get("parent_game")
    external_parent_name = parent_ref.get("name") if isinstance(parent_ref, dict) else None
    external_parent_igdb_url = parent_ref.get("url") if isinstance(parent_ref, dict) else None

    return IgdbGamePreviewResponse(
        igdb_id=igdb_game["id"],
        name=igdb_game.get("name") or f"IGDB #{igdb_game['id']}",
        slug=igdb_game.get("slug"),
        cover_url=igdb_game.get("cover_url"),
        category=category,
        first_release_date=igdb_game.get("first_release_date"),
        summary=igdb_game.get("summary"),
        storyline=igdb_game.get("storyline"),
        igdb_url=igdb_game.get("url"),
        external_parent_name=external_parent_name,
        external_parent_igdb_url=external_parent_igdb_url,
        genres=_refs(igdb_game.get("genres")),
        companies=sorted(companies.values(), key=lambda c: (c.name.lower(), c.role.value)),
        franchises=_refs(igdb_game.get("franchises")),
        collections=_refs(igdb_game.get("collections")),
        platforms=[
            PlatformResponse(
                id=platform["id"],
                igdb_id=platform["id"],
                name=platform["name"],
                slug=platform.get("slug"),
                abbreviation=platform.get("abbreviation"),
            )
            for platform in igdb_game.get("platforms") or []
            if platform.get("id") is not None and platform.get("name")
        ],
        screenshot_urls=[s["url"] for s in igdb_game.get("screenshots") or [] if s.get("url")],
        artwork_urls=[a["url"] for a in igdb_game.get("artworks") or [] if a.get("url")],
        videos=[
            GameVideoResponse(id=v["id"], name=v.get("name"), video_id=v["video_id"])
            for v in igdb_game.get("videos") or []
            if v.get("video_id")
        ],
        release_dates=[
            ReleaseDateResponse(
                id=rd["id"],
                date=rd.get("date"),
                human=rd.get("human"),
                platform_name=(rd.get("platform") or {}).get("name"),
                release_region=IgdbReleaseRegion.from_igdb_value(rd.get("release_region")),
            )
            for rd in igdb_game.get("release_dates") or []
            if rd.get("id") is not None
        ],
        local_game=(
            LocalGameRefResponse(slug=local_game.slug, uuid=local_game.uuid, name=local_game.name)
            if local_game is not None
            else None
        ),
        **store_urls,
    )
