from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.addon_link import AddonLinkPairResponse, addon_ref_from_orm
from app.services import addon_link_service
from app.services.labs import LAB_LINKED_ADDONS, require_lab

# Settings → Linked Add-ons (Linked Add-ons lab). Linking and unlinking live under /api/games;
# this is only the overview of every link.
router = APIRouter(
    prefix="/api/addon-links",
    tags=["addon-links"],
    dependencies=[Depends(get_current_user), Depends(require_lab(LAB_LINKED_ADDONS))],
)


@router.get("", response_model=list[AddonLinkPairResponse])
def list_addon_links(db: Session = Depends(get_db)) -> list[AddonLinkPairResponse]:
    return [
        AddonLinkPairResponse(addon=addon_ref_from_orm(addon), game=addon_ref_from_orm(game))
        for addon, game in addon_link_service.list_all(db)
    ]
