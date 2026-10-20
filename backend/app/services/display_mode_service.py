from sqlalchemy.orm import Session

from app.models.app_settings import AppSetting

DEFAULT_SLIDE_INTERVAL_SECONDS = 10
DEFAULT_SHOW_TITLE = False
DEFAULT_SHOW_HIDDEN = False
DEFAULT_SHOW_WISHLISTED = False
DEFAULT_MEDIA_COVER_ART = True
DEFAULT_MEDIA_SCREENSHOTS = True
DEFAULT_MEDIA_ARTWORK = True
DEFAULT_MEDIA_VIDEOS = True
DEFAULT_VOLUME = 80

INTERVAL_KEY = "display_mode.slide_interval_seconds"
SHOW_TITLE_KEY = "display_mode.show_title"
SHOW_HIDDEN_KEY = "display_mode.show_hidden"
SHOW_WISHLISTED_KEY = "display_mode.show_wishlisted"
MEDIA_COVER_ART_KEY = "display_mode.media_cover_art"
MEDIA_SCREENSHOTS_KEY = "display_mode.media_screenshots"
MEDIA_ARTWORK_KEY = "display_mode.media_artwork"
MEDIA_VIDEOS_KEY = "display_mode.media_videos"
VOLUME_KEY = "display_mode.volume"


def _get_value(db: Session, key: str, default: str) -> str:
    setting = db.get(AppSetting, key)
    return setting.value if setting else default


def _set_value(db: Session, key: str, value: str) -> None:
    setting = db.get(AppSetting, key)
    if setting:
        setting.value = value
    else:
        db.add(AppSetting(key=key, value=value))
    db.commit()


def get_settings(db: Session) -> dict[str, int | bool]:
    try:
        interval = int(_get_value(db, INTERVAL_KEY, str(DEFAULT_SLIDE_INTERVAL_SECONDS)))
    except ValueError:
        interval = DEFAULT_SLIDE_INTERVAL_SECONDS
    interval = max(3, min(120, interval))
    try:
        volume = int(_get_value(db, VOLUME_KEY, str(DEFAULT_VOLUME)))
    except ValueError:
        volume = DEFAULT_VOLUME
    volume = max(0, min(100, volume))
    return {
        "slide_interval_seconds": interval,
        "show_title": _get_value(db, SHOW_TITLE_KEY, "false").lower() == "true",
        "show_hidden": _get_value(db, SHOW_HIDDEN_KEY, "false").lower() == "true",
        "show_wishlisted": _get_value(db, SHOW_WISHLISTED_KEY, "false").lower() == "true",
        "media_cover_art": _get_value(db, MEDIA_COVER_ART_KEY, "true").lower() == "true",
        "media_screenshots": _get_value(db, MEDIA_SCREENSHOTS_KEY, "true").lower() == "true",
        "media_artwork": _get_value(db, MEDIA_ARTWORK_KEY, "true").lower() == "true",
        "media_videos": _get_value(db, MEDIA_VIDEOS_KEY, "true").lower() == "true",
        "volume": volume,
    }


def update_settings(
    db: Session,
    slide_interval_seconds: int | None = None,
    show_title: bool | None = None,
    show_hidden: bool | None = None,
    show_wishlisted: bool | None = None,
    media_cover_art: bool | None = None,
    media_screenshots: bool | None = None,
    media_artwork: bool | None = None,
    media_videos: bool | None = None,
    volume: int | None = None,
) -> dict[str, int | bool]:
    if slide_interval_seconds is not None:
        _set_value(db, INTERVAL_KEY, str(max(3, min(120, slide_interval_seconds))))
    if show_title is not None:
        _set_value(db, SHOW_TITLE_KEY, "true" if show_title else "false")
    if show_hidden is not None:
        _set_value(db, SHOW_HIDDEN_KEY, "true" if show_hidden else "false")
    if show_wishlisted is not None:
        _set_value(db, SHOW_WISHLISTED_KEY, "true" if show_wishlisted else "false")
    if media_cover_art is not None:
        _set_value(db, MEDIA_COVER_ART_KEY, "true" if media_cover_art else "false")
    if media_screenshots is not None:
        _set_value(db, MEDIA_SCREENSHOTS_KEY, "true" if media_screenshots else "false")
    if media_artwork is not None:
        _set_value(db, MEDIA_ARTWORK_KEY, "true" if media_artwork else "false")
    if media_videos is not None:
        _set_value(db, MEDIA_VIDEOS_KEY, "true" if media_videos else "false")
    if volume is not None:
        _set_value(db, VOLUME_KEY, str(max(0, min(100, volume))))
    return get_settings(db)
