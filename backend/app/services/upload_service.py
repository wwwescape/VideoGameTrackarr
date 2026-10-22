import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import UPLOADS_DIR

COVERS_DIR = UPLOADS_DIR / "covers"
COVERS_URL_PREFIX = "/uploads/covers/"
ACCESSORY_IMAGES_DIR = UPLOADS_DIR / "accessory-images"
ACCESSORY_IMAGES_URL_PREFIX = "/uploads/accessory-images/"
SPINES_DIR = UPLOADS_DIR / "spines"
SPINES_URL_PREFIX = "/uploads/spines/"
# Spine scans vary wildly in aspect ratio (a Switch spine vs an N64 top spine), so
# unlike covers they are never cropped to a fixed size — only capped on the long
# edge and re-encoded, preserving the scan's own proportions for Bookshelf mode.
SPINE_MAX_EDGE = 1200
# Matches IGDB's t_720p cover size (see igdb_client.py) so uploaded covers render identically
# to IGDB-sourced ones instead of relying on CSS object-fit to paper over a mismatched source.
COVER_TARGET_SIZE = (540, 720)
# Matches the curated hardware reference product shots (backend/static/hardware-reference).
ACCESSORY_TARGET_SIZE = (400, 400)
JPEG_QUALITY = 85


def _save_optimized_image(raw: bytes, directory: Path, url_prefix: str, target_size: tuple[int, int]) -> str:
    """Center-crops an uploaded image to fill target_size exactly (upscaling if the source is
    smaller) and re-encodes it as JPEG, saving it under `directory` and returning the URL it's
    served at."""
    try:
        image = Image.open(BytesIO(raw))
        image.load()
    except UnidentifiedImageError as exc:
        raise ValueError("Not a valid image file") from exc

    image = image.convert("RGB")
    image = ImageOps.fit(image, target_size, method=Image.Resampling.LANCZOS)

    directory.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}.jpg"
    image.save(directory / filename, format="JPEG", quality=JPEG_QUALITY)
    return f"{url_prefix}{filename}"


def save_cover_image(raw: bytes) -> str:
    return _save_optimized_image(raw, COVERS_DIR, COVERS_URL_PREFIX, COVER_TARGET_SIZE)


def save_accessory_image(raw: bytes) -> str:
    return _save_optimized_image(raw, ACCESSORY_IMAGES_DIR, ACCESSORY_IMAGES_URL_PREFIX, ACCESSORY_TARGET_SIZE)


def save_spine_image(raw: bytes) -> str:
    """Validates an uploaded spine scan and stores it under SPINES_DIR, preserving
    its aspect ratio (downscaling only when the long edge exceeds SPINE_MAX_EDGE).
    Returns the /uploads/spines/... URL it's served at."""
    try:
        image = Image.open(BytesIO(raw))
        image.load()
    except UnidentifiedImageError as exc:
        raise ValueError("Not a valid image file") from exc

    image = image.convert("RGB")
    if max(image.size) > SPINE_MAX_EDGE:
        image.thumbnail((SPINE_MAX_EDGE, SPINE_MAX_EDGE), resample=Image.Resampling.LANCZOS)

    SPINES_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}.jpg"
    image.save(SPINES_DIR / filename, format="JPEG", quality=JPEG_QUALITY)
    return f"{SPINES_URL_PREFIX}{filename}"


def delete_spine_if_local(url: str | None) -> None:
    """Best-effort cleanup for a spine upload that's being replaced or cleared —
    a no-op for external URLs and None. Same resolve-and-contain guard as
    delete_if_local_upload (the stored value can come from a request body)."""
    if url is None or not url.startswith(SPINES_URL_PREFIX):
        return
    filename = url.removeprefix(SPINES_URL_PREFIX)
    candidate = (SPINES_DIR / filename).resolve()
    if candidate.is_relative_to(SPINES_DIR.resolve()):
        candidate.unlink(missing_ok=True)


def delete_if_local_upload(url: str | None) -> None:
    """Best-effort cleanup for a cover that's about to be replaced (e.g. once a manually
    added game gets linked to IGDB and starts using IGDB's own cover instead) — a no-op for
    anything that isn't one of our own uploaded files (an IGDB cover URL, or none at all).
    cover_url ultimately comes from a request body (ManualGameCreateRequest.cover_url is
    free text, not restricted to URLs save_cover_image actually generated), so resolving and
    confirming the result is still inside COVERS_DIR — rather than trusting the joined path
    directly — guards against a crafted value like "/uploads/covers/../../../etc/passwd"."""
    if url is None or not url.startswith(COVERS_URL_PREFIX):
        return
    filename = url.removeprefix(COVERS_URL_PREFIX)
    candidate = (COVERS_DIR / filename).resolve()
    if candidate.is_relative_to(COVERS_DIR.resolve()):
        candidate.unlink(missing_ok=True)
