from app.core.config import TOYS_TO_LIFE_IMAGES_DIR
from app.models.toys_to_life import ToysToLifeItem
from app.services.hardware_reference_image_service import slugify


def image_filename(item: ToysToLifeItem) -> str:
    """`<set number>-<kebab-case name>.png`, e.g. 71203-portal-2-level-pack.png."""
    return f"{item.set_number}-{slugify(item.name)}.png"


def resolve_image_url(item: ToysToLifeItem) -> str | None:
    """Like the hardware reference shots: no DB column, just a correctly-named file dropped
    into backend/static/toys-to-life/<line>/, checked on the filesystem live."""
    filename = image_filename(item)
    if (TOYS_TO_LIFE_IMAGES_DIR / item.line / filename).is_file():
        return f"/static/toys-to-life/{item.line}/{filename}"
    return None
