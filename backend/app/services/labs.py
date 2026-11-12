"""Settings > Labs: VGT's feature flags. Each lab is an experimental feature you turn on for
the whole app (the share page included); every lab is off until turned on. Adding a lab is one
more entry in LABS, a name and description in the frontend's `settings.labs.*` strings, and
`require_lab(...)` on its routes."""

from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.labs import LabFeature
from app.services.exceptions import NotFoundError

LAB_GAME_SHELF = "game_shelf"
LAB_SCREENSAVER = "screensaver"
# Named game-list filters (Presets on the list toolbar); stored on the account like other
# display preferences.
LAB_FILTER_PRESETS = "filter_presets"


@dataclass(frozen=True)
class Lab:
    id: str
    # Whether the share page has anything for it (and so is told it's on).
    on_share_page: bool = False


# In the order Settings > Labs lists them.
LABS: tuple[Lab, ...] = (
    Lab(LAB_GAME_SHELF, on_share_page=True),
    Lab(LAB_SCREENSAVER),
    Lab(LAB_FILTER_PRESETS),
)
_KNOWN = {lab.id for lab in LABS}


def is_enabled(db: Session, lab_id: str) -> bool:
    row = db.get(LabFeature, lab_id)
    return bool(row and row.enabled)


def list_labs(db: Session) -> list[tuple[Lab, bool]]:
    return [(lab, is_enabled(db, lab.id)) for lab in LABS]


def enabled_ids(db: Session, *, share_page: bool = False) -> list[str]:
    """The labs that are on; with share_page, only those the share page has anything for, so it
    doesn't learn about the rest."""
    return [lab.id for lab, enabled in list_labs(db) if enabled and (lab.on_share_page or not share_page)]


def set_enabled(db: Session, lab_id: str, enabled: bool) -> None:
    if lab_id not in _KNOWN:
        raise NotFoundError(f"Lab {lab_id!r} not found")
    row = db.get(LabFeature, lab_id)
    if row is None:
        db.add(LabFeature(id=lab_id, enabled=enabled))
    else:
        row.enabled = enabled
    db.commit()


def require_lab(lab_id: str) -> Callable[[Session], None]:
    """A route dependency: 404 while the lab is off, as if the feature weren't there."""

    def dependency(db: Session = Depends(get_db)) -> None:
        if not is_enabled(db, lab_id):
            raise NotFoundError("Not found")

    return dependency
