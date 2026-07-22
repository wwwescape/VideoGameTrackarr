import re

from app.core.config import HARDWARE_REFERENCE_IMAGES_DIR

_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    return _NON_ALNUM_RE.sub("-", name.lower()).strip("-")


def resolve_image_url(official_name: str) -> str | None:
    """Curated product shots have no DB-stored URL — sourcing a new one is meant to be as
    simple as dropping a correctly-named file into HARDWARE_REFERENCE_IMAGES_DIR and
    committing, with no code or migration change required. So this checks the filesystem
    directly rather than trusting a column that would otherwise need updating by hand every
    time an image is added."""
    filename = f"{slugify(official_name)}.jpg"
    if (HARDWARE_REFERENCE_IMAGES_DIR / filename).is_file():
        return f"/static/hardware-reference/{filename}"
    return None
