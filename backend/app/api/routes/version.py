from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.core.config import get_app_version
from app.schemas.version import VersionResponse
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
