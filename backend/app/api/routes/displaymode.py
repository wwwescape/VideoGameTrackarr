from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.repositories import game_repository
from app.schemas.display_mode import (
    MEDIA_ARTWORK,
    MEDIA_COVER_ART,
    MEDIA_SCREENSHOT,
    MEDIA_VIDEO,
    DisplayModeSettingsResponse,
    DisplayModeSettingsUpdate,
    DisplayModeSlide,
)
from app.services import display_mode_service

router = APIRouter(
    prefix="/api/display-mode",
    tags=["display-mode"],
    dependencies=[Depends(get_current_user)],
)

settings_router = APIRouter(
    prefix="/api/settings/display-mode",
    tags=["settings"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/slides", response_model=list[DisplayModeSlide])
def get_slides(
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[DisplayModeSlide]:
    """Random sample of media slides for Display Mode, freshly shuffled on every
    fetch. The display-mode settings decide which media types are included and
    whether hidden and wishlisted games are included (both excluded by default)."""
    settings = display_mode_service.get_settings(db)
    media_types = set()
    if settings["media_cover_art"]:
        media_types.add(MEDIA_COVER_ART)
    if settings["media_screenshots"]:
        media_types.add(MEDIA_SCREENSHOT)
    if settings["media_artwork"]:
        media_types.add(MEDIA_ARTWORK)
    if settings["media_videos"]:
        media_types.add(MEDIA_VIDEO)
    slides = game_repository.list_display_mode_slides(
        db,
        limit=limit,
        include_hidden=settings["show_hidden"],
        include_wishlisted=settings["show_wishlisted"],
        media_types=media_types,
    )
    return [
        DisplayModeSlide(id=slide[0], name=slide[1], media_type=slide[2], media_url=slide[3])
        for slide in slides
    ]


@settings_router.get("", response_model=DisplayModeSettingsResponse)
def get_display_mode_settings(db: Session = Depends(get_db)) -> DisplayModeSettingsResponse:
    settings = display_mode_service.get_settings(db)
    return DisplayModeSettingsResponse(**settings)


@settings_router.put("", response_model=DisplayModeSettingsResponse)
def update_display_mode_settings(
    body: DisplayModeSettingsUpdate, db: Session = Depends(get_db)
) -> DisplayModeSettingsResponse:
    settings = display_mode_service.update_settings(
        db,
        slide_interval_seconds=body.slide_interval_seconds,
        show_title=body.show_title,
        show_hidden=body.show_hidden,
        show_wishlisted=body.show_wishlisted,
        media_cover_art=body.media_cover_art,
        media_screenshots=body.media_screenshots,
        media_artwork=body.media_artwork,
        media_videos=body.media_videos,
        volume=body.volume,
    )
    return DisplayModeSettingsResponse(**settings)
