import uuid
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import UPLOADS_DIR

COVERS_DIR = UPLOADS_DIR / "covers"
COVERS_URL_PREFIX = "/uploads/covers/"
ACCESSORY_IMAGES_DIR = UPLOADS_DIR / "accessory-images"
ACCESSORY_IMAGES_URL_PREFIX = "/uploads/accessory-images/"
# Matches IGDB's t_720p cover size (see igdb_client.py) so uploaded covers render identically
# to IGDB-sourced ones instead of relying on CSS object-fit to paper over a mismatched source.
COVER_TARGET_SIZE = (540, 720)
# Matches the curated hardware reference product shots (backend/static/hardware-reference).
ACCESSORY_TARGET_SIZE = (400, 400)
JPEG_QUALITY = 85
# Only the formats people actually upload covers and product photos in. Pillow can decode many
# more (TIFF, PSD, PPM, ...), and its rarer decoders are where its memory-safety bugs tend to be,
# so nothing else is ever handed to them.
ALLOWED_IMAGE_FORMATS = ["JPEG", "PNG", "WEBP", "GIF"]
# Far above any real cover or product shot; checked while the upload is read (see
# app/api/routes/uploads.py), so an oversized one is refused before it's held in memory.
MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024


def _save_optimized_image(raw: bytes, directory: Path, url_prefix: str, target_size: tuple[int, int]) -> str:
    """Center-crops an uploaded image to fill target_size exactly (upscaling if the source is
    smaller) and re-encodes it as JPEG, saving it under `directory` and returning the URL it's
    served at."""
    try:
        image = Image.open(BytesIO(raw), formats=ALLOWED_IMAGE_FORMATS)
        image.load()
    except UnidentifiedImageError as exc:
        raise ValueError("Not a supported image (use JPEG, PNG, WebP or GIF)") from exc
    except Image.DecompressionBombError as exc:
        raise ValueError("Image dimensions are too large") from exc

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


def delete_if_local_upload(url: str | None) -> None:
    """Best-effort cleanup for a cover that's about to be replaced (e.g. once a manually
    added game gets linked to IGDB and starts using IGDB's own cover instead) — a no-op for
    anything that isn't one of our own uploaded files (an IGDB cover URL, or none at all).
    cover_url ultimately comes from a request body (ManualGameCreateRequest.cover_url is
    free text, not restricted to URLs save_cover_image actually generated), so resolving and
    confirming the result is still inside COVERS_DIR — rather than trusting the joined path
    directly — guards against a crafted value like "/uploads/covers/../../../etc/passwd".
    Covers accessory photos too (the Danger Zone's resets remove both), and only ever a file
    inside the folder, never the folder itself (an empty name)."""
    if url is None:
        return
    for prefix, directory in ((COVERS_URL_PREFIX, COVERS_DIR), (ACCESSORY_IMAGES_URL_PREFIX, ACCESSORY_IMAGES_DIR)):
        if not url.startswith(prefix):
            continue
        root = directory.resolve()
        candidate = (directory / url.removeprefix(prefix)).resolve()
        if candidate != root and candidate.is_relative_to(root) and not candidate.is_dir():
            candidate.unlink(missing_ok=True)
        return
