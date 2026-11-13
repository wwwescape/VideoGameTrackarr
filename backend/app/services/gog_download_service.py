import re
from pathlib import Path
from urllib.parse import unquote, urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import UPLOADS_DIR
from app.models.gog import GogDownload, GogDownloadStatus

# Subfolder of UPLOADS_DIR so downloads land on the same persistent Docker volume
# as every other upload — no compose change needed. The folder is blocked from the
# public /uploads mount (see main.py's UploadsStaticFiles): completed installers are
# only ever served through the authenticated file route.
GOG_DOWNLOADS_SUBDIR = "gog-installers"


def get_downloads_dir() -> Path:
    return UPLOADS_DIR / GOG_DOWNLOADS_SUBDIR


def sanitize_filename(raw: str) -> str:
    """A CDN URL basename made safe for disk — GOG installer names carry version
    info in parentheses (setup_the_witcher_3_1.32_(64bit)_(64340).exe), which is
    kept; anything outside a plain filename charset is replaced."""
    name = unquote(raw).strip().replace("\\", "_").replace("/", "_")
    name = re.sub(r"[^A-Za-z0-9._()+-]+", "_", name).strip("._")
    return name or "installer.bin"


def filename_from_url(url: str, fallback: str) -> str:
    basename = urlparse(url).path.rsplit("/", 1)[-1]
    return sanitize_filename(basename) if basename else sanitize_filename(fallback)


def download_file_path(download: GogDownload) -> Path | None:
    if not download.filename:
        return None
    return get_downloads_dir() / str(download.gog_product_id) / download.filename


def get_download(db: Session, gog_product_id: int, file_id: str) -> GogDownload | None:
    return db.scalars(
        select(GogDownload).where(
            GogDownload.gog_product_id == gog_product_id, GogDownload.file_id == file_id
        )
    ).first()


def list_downloads_for_game(db: Session, game_id: int) -> list[GogDownload]:
    return list(db.scalars(select(GogDownload).where(GogDownload.game_id == game_id)))


def create_or_reuse_download(
    db: Session,
    game_id: int,
    gog_product_id: int,
    installer_id: str,
    file_id: str,
    total_size: int,
) -> GogDownload:
    """Queues a file for the NAS drainer. An existing row is reused: a completed
    row whose file is still on disk at the right size stays completed (re-queueing
    is a no-op — the file route serves it); a failed row is reset to queued so the
    same button retries it; a queued/downloading row is returned as-is."""
    existing = get_download(db, gog_product_id, file_id)
    if existing is not None:
        if existing.status == GogDownloadStatus.COMPLETED and verify_completed_file(existing):
            return existing
        if existing.status in (GogDownloadStatus.FAILED, GogDownloadStatus.COMPLETED):
            # Failed, or completed but the file is gone/truncated — reset to queued
            # so the same button retries the download from scratch.
            existing.status = GogDownloadStatus.QUEUED
            existing.downloaded_bytes = 0
            existing.error = None
            existing.total_size = total_size
            db.commit()
            return existing
        return existing

    download = GogDownload(
        game_id=game_id,
        gog_product_id=gog_product_id,
        installer_id=installer_id,
        file_id=file_id,
        total_size=total_size,
        status=GogDownloadStatus.QUEUED,
    )
    db.add(download)
    db.commit()
    db.refresh(download)
    return download


def verify_completed_file(download: GogDownload) -> bool:
    """A completed row is only "already downloaded" while its file is actually on
    disk at the expected size — a missing or truncated file (deleted from the NAS,
    or a partial write) falls back to re-download."""
    if download.status != GogDownloadStatus.COMPLETED:
        return False
    path = download_file_path(download)
    if path is None or not path.is_file():
        return False
    return download.total_size <= 0 or path.stat().st_size == download.total_size


def reset_stale_downloads(db: Session) -> int:
    """Rows left "downloading" by a restart or crash go back to queued — the drainer
    calls this at the start of every run, so an interrupted download resumes from
    the queue instead of sitting stuck."""
    stale = list(
        db.scalars(select(GogDownload).where(GogDownload.status == GogDownloadStatus.DOWNLOADING))
    )
    for download in stale:
        download.status = GogDownloadStatus.QUEUED
        download.downloaded_bytes = 0
    if stale:
        db.commit()
    return len(stale)


def next_queued_download(db: Session) -> GogDownload | None:
    return db.scalars(
        select(GogDownload)
        .where(GogDownload.status == GogDownloadStatus.QUEUED)
        .order_by(GogDownload.created_at, GogDownload.id)
    ).first()


def set_status(db: Session, download: GogDownload, status: str, error: str | None = None) -> None:
    download.status = status
    download.error = error
    db.commit()


def set_progress(db: Session, download: GogDownload, downloaded_bytes: int) -> None:
    download.downloaded_bytes = downloaded_bytes
    db.commit()


def set_total_size(db: Session, download: GogDownload, total_size: int) -> None:
    """Corrects the row's expected size to the bytes actually downloaded — GOG's
    API sizes are rounded to whole megabytes, so the queued size is only ever an
    estimate until the file is on disk (see gog_jobs._download_one)."""
    download.total_size = total_size
    db.commit()


def set_filename(db: Session, download: GogDownload, filename: str) -> None:
    download.filename = filename
    db.commit()
