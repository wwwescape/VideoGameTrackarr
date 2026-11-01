from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import get_app_version
from app.models.system import User
from app.schemas.version import VersionResponse, WhatsNewRelease, WhatsNewResponse
from app.services import version_service

router = APIRouter(prefix="/api/version", tags=["version"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=VersionResponse)
async def get_version(force: bool = Query(default=False)) -> VersionResponse:
    current_version = get_app_version()
    latest_release = await version_service.get_latest_release(force=force)

    if latest_release is None:
        return VersionResponse(
            current_version=current_version, latest_version=None, update_available=False, release_url=None
        )

    return VersionResponse(
        current_version=current_version,
        latest_version=latest_release.tag_name,
        update_available=version_service.is_newer(latest_release.tag_name, current_version),
        release_url=latest_release.html_url,
    )


@router.get("/whats-new", response_model=WhatsNewResponse)
async def get_whats_new(current_user: User = Depends(get_current_user)) -> WhatsNewResponse:
    """The release notes you haven't seen since upgrading (shown once, then marked seen)."""
    current_version = get_app_version()
    whats_new = await version_service.get_whats_new(current_version, current_user.last_seen_version)
    return WhatsNewResponse(
        current_version=current_version,
        releases=[
            WhatsNewRelease(
                version=release.tag_name.removeprefix("v"),
                name=release.name,
                body=release.body,
                url=release.html_url,
                published_at=release.published_at,
            )
            for release in whats_new.releases
        ],
        notes_unavailable=whats_new.notes_unavailable,
        release_url=version_service.release_url_for(current_version),
    )


@router.post("/whats-new/seen", status_code=status.HTTP_204_NO_CONTENT)
def mark_whats_new_seen(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    """Records the running version as seen, on the account, so no device shows it again."""
    current_user.last_seen_version = get_app_version()
    db.commit()
