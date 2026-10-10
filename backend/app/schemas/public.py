from app.models.catalog import GameCategory
from app.repositories.accessory_repository import AccessoryWithStatus
from app.repositories.device_repository import DeviceWithStatus
from app.repositories.game_repository import GameWithStatus, is_top_level_browsable
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
from app.services.hardware_reference_image_service import resolve_image_url


class PublicGameSummaryResponse(CamelModel):
    id: int
    name: str
    cover_url: str | None
    category: GameCategory | None
    first_release_date: int | None
    owned: bool
    wishlisted: bool


def public_game_from_orm(status: GameWithStatus) -> PublicGameSummaryResponse:
    game = status.game
    return PublicGameSummaryResponse(
        id=game.id,
        name=game.name,
        cover_url=game.cover_url,
        category=game.category,
        first_release_date=game.first_release_date,
        owned=status.owned,
        wishlisted=status.wishlisted,
    )


class PublicGameDetailResponse(PublicGameSummaryResponse):
    """Just the About section's data: catalog facts from IGDB plus owned/wishlisted. None of
    the owner's own data (tags, library copies, progress/rating, notes, sale tracking).
    Field names match GameDetailResponse so the frontend's GameAboutSection reads either."""

    igdb_id: int | None
    igdb_url: str | None
    summary: str | None
    storyline: str | None
    edition: str | None
    # Always null: the About section's rating chip is the owner's own rating (progress data).
    rating: float | None
    # Always null: only top-level games are public, so there's never a hierarchical parent.
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
    genres: list[CatalogRefResponse]
    companies: list[GameCompanyResponse]
    franchises: list[CatalogRefResponse]
    collections: list[CatalogRefResponse]
    platforms: list[PlatformResponse]
    screenshot_urls: list[str]
    artwork_urls: list[str]
    videos: list[GameVideoResponse]
    release_dates: list[ReleaseDateResponse]
    steam_store_url: str | None
    xbox_store_url: str | None
    playstation_store_url: str | None
    nintendo_store_url: str | None
    epic_games_store_url: str | None
    gog_store_url: str | None


def public_game_detail_from_orm(status: GameWithStatus) -> PublicGameDetailResponse:
    game = status.game
    # Only link a display parent that's public itself, so the page never links to a 404.
    display_parent = game.display_parent_game
    if display_parent is not None and not is_top_level_browsable(display_parent):
        display_parent = None
    return PublicGameDetailResponse(
        **public_game_from_orm(status).model_dump(),
        igdb_id=game.igdb_id,
        igdb_url=game.igdb_url,
        summary=game.summary,
        storyline=game.storyline,
        edition=game.edition,
        rating=None,
        parent_game_id=None,
        parent_game_name=None,
        parent_game_slug=None,
        parent_game_uuid=None,
        display_parent_game_id=display_parent.id if display_parent else None,
        display_parent_game_name=display_parent.name if display_parent else None,
        display_parent_game_slug=display_parent.slug if display_parent else None,
        display_parent_game_uuid=display_parent.uuid if display_parent else None,
        external_parent_name=game.external_parent_name,
        external_parent_igdb_url=game.external_parent_igdb_url,
        genres=[genre_ref_from_orm(gg.genre) for gg in game.genres],
        companies=[game_company_from_orm(gc) for gc in game.companies],
        franchises=[franchise_ref_from_orm(gf.franchise) for gf in game.franchises],
        collections=[collection_ref_from_orm(gcol.collection) for gcol in game.collections],
        platforms=[PlatformResponse.model_validate(gp.platform) for gp in game.platforms],
        screenshot_urls=[s.url for s in game.screenshots],
        artwork_urls=[a.url for a in game.artworks],
        videos=[game_video_from_orm(v) for v in game.videos],
        release_dates=[release_date_from_orm(rd) for rd in game.release_dates],
        steam_store_url=game.steam_store_url,
        xbox_store_url=game.xbox_store_url,
        playstation_store_url=game.playstation_store_url,
        nintendo_store_url=game.nintendo_store_url,
        epic_games_store_url=game.epic_games_store_url,
        gog_store_url=game.gog_store_url,
    )


class PublicDeviceSummaryResponse(CamelModel):
    id: int
    official_name: str
    manufacturer_name: str
    hardware_platform_name: str | None
    image_url: str | None
    owned: bool
    wishlisted: bool
    owned_quantity: int


def public_device_from_orm(item: DeviceWithStatus) -> PublicDeviceSummaryResponse:
    device = item.device
    return PublicDeviceSummaryResponse(
        id=device.id,
        official_name=device.official_name,
        manufacturer_name=device.manufacturer.name,
        hardware_platform_name=device.hardware_platform.name if device.hardware_platform else None,
        image_url=(
            resolve_image_url(device.hardware_reference_entry.official_name)
            if device.hardware_reference_entry
            else None
        ),
        owned=item.owned,
        wishlisted=item.wishlisted,
        owned_quantity=item.owned_quantity,
    )


class PublicAccessorySummaryResponse(CamelModel):
    id: int
    official_name: str
    manufacturer_name: str
    image_url: str | None
    owned: bool
    wishlisted: bool
    owned_quantity: int


def public_accessory_from_orm(item: AccessoryWithStatus) -> PublicAccessorySummaryResponse:
    accessory = item.accessory
    return PublicAccessorySummaryResponse(
        id=accessory.id,
        official_name=accessory.official_name,
        manufacturer_name=accessory.manufacturer.name,
        image_url=accessory.image_url
        or (
            resolve_image_url(accessory.hardware_reference_entry.official_name)
            if accessory.hardware_reference_entry
            else None
        ),
        owned=item.owned,
        wishlisted=item.wishlisted,
        owned_quantity=item.owned_quantity,
    )
