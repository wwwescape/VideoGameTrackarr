import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from app.core.config import UPLOADS_DIR

COVERS_DIR = UPLOADS_DIR / "covers"
COVERS_URL_PREFIX = "/uploads/covers/"
ACCESSORY_IMAGES_DIR = UPLOADS_DIR / "accessory-images"
ACCESSORY_IMAGES_URL_PREFIX = "/uploads/accessory-images/"
MAX_IMAGE_DIMENSIONS = (960, 1280)
JPEG_QUALITY = 85


def _save_optimized_image(raw: bytes, directory: Path, url_prefix: str) -> str:
    """Downscales an uploaded image to fit MAX_IMAGE_DIMENSIONS and re-encodes it as JPEG,
    saving it under `directory` and returning the URL it's served at."""
    try:
        image = Image.open(BytesIO(raw))
        image.load()
    except UnidentifiedImageError as exc:
        raise ValueError("Not a valid image file") from exc

    image = image.convert("RGB")
    image.thumbnail(MAX_IMAGE_DIMENSIONS)

    directory.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}.jpg"
    image.save(directory / filename, format="JPEG", quality=JPEG_QUALITY)
    return f"{url_prefix}{filename}"


def save_cover_image(raw: bytes) -> str:
    return _save_optimized_image(raw, COVERS_DIR, COVERS_URL_PREFIX)


def save_accessory_image(raw: bytes) -> str:
    return _save_optimized_image(raw, ACCESSORY_IMAGES_DIR, ACCESSORY_IMAGES_URL_PREFIX)


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
