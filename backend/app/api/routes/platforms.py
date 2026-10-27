from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.routes.game_filters import GameFilterParams
from app.models.library import MediaFormat
from app.repositories import platform_repository
from app.schemas.game import GameSummaryResponse, game_summary_from_orm
from app.schemas.platform import LibraryPlatformResponse, PlatformResponse
from app.services import game_service, insight_service, platform_service

router = APIRouter(prefix="/api/platforms", tags=["platforms"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[PlatformResponse])
def list_platforms(db: Session = Depends(get_db)) -> list[PlatformResponse]:
    platforms = platform_repository.list_platforms(db)
    return [PlatformResponse.model_validate(platform) for platform in platforms]


# Declared before /{slug_or_id} so "library" isn't read as a platform slug.
@router.get("/library", response_model=list[LibraryPlatformResponse])
def list_library_platforms(db: Session = Depends(get_db)) -> list[LibraryPlatformResponse]:
    return [
        LibraryPlatformResponse(
            id=row.platform.id,
            name=row.platform.name,
            slug=row.platform.slug,
            abbreviation=row.platform.abbreviation,
            format=row.media_format.value if row.media_format else None,
            storefront=row.storefront,
            owned_count=row.owned,
            wishlisted_count=row.wishlisted,
        )
        for row in platform_service.list_library_platforms(db)
    ]


@router.get("/{slug_or_id}", response_model=PlatformResponse)
def get_platform(slug_or_id: str, db: Session = Depends(get_db)) -> PlatformResponse:
    return PlatformResponse.model_validate(platform_service.get_platform(db, slug_or_id))


@router.get("/{slug_or_id}/addons", response_model=list[GameSummaryResponse])
def list_platform_addons(
    slug_or_id: str,
    params: GameFilterParams = Depends(),
    # Same names as GET /api/games, for a PC storefront card's page.
    required_platform_format: MediaFormat | None = Query(default=None, alias="requiredPlatformFormat"),
    required_platform_storefront: str | None = Query(default=None, alias="requiredPlatformStorefront"),
    db: Session = Depends(get_db),
) -> list[GameSummaryResponse]:
    addons = platform_service.list_platform_addons(
        db, slug_or_id, required_platform_format, required_platform_storefront, **vars(params)
    )
    on_sale_game_ids = insight_service.get_on_sale_game_ids(db)
    addons = game_service.sort_by_labels(addons, params.sort, on_sale_game_ids)
    return [game_summary_from_orm(addon, on_sale_game_ids) for addon in addons]
