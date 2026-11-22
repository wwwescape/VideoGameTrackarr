"""Offline installers downloaded to the server (uploads/gog-installers/<product id>/<file>).

The gog_downloads table is the queue: rows are queued here and worked through one file at
a time by the gog_download job (gog_jobs.run_download). Files are served back only through
the signed-link route in api/routes/integrations.py, never through the public /uploads
mount (see main.py's UploadsStaticFiles), and are never part of a backup.
"""

import re
import shutil
from pathlib import Path
from urllib.parse import unquote, urlparse

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.config import UPLOADS_DIR
from app.models.gog import GogDownload, GogDownloadStatus
from app.services.exceptions import NotFoundError
from app.services.gog_client import GogInstaller

GOG_DOWNLOADS_SUBDIR = "gog-installers"
_PART_SUFFIX = ".part"


def get_downloads_dir() -> Path:
    return UPLOADS_DIR / GOG_DOWNLOADS_SUBDIR


def sanitize_filename(raw: str) -> str:
    """A CDN file name made safe for disk. GOG's names carry the version in parentheses,
    e.g. setup_the_witcher_3_4.04_(64bit)_(68640).exe, which is kept."""
    name = unquote(raw).strip().replace("\\", "_").replace("/", "_")
    name = re.sub(r"[^A-Za-z0-9._()+-]+", "_", name).strip("._")
    return name[:200] or "installer.bin"


def filename_from_url(url: str, fallback: str) -> str:
    basename = urlparse(url).path.rsplit("/", 1)[-1]
    return sanitize_filename(basename or fallback)


def file_path(download: GogDownload) -> Path | None:
    if not download.filename:
        return None
    return get_downloads_dir() / str(download.gog_product_id) / download.filename


def part_path(download: GogDownload) -> Path | None:
    path = file_path(download)
    return path.with_name(path.name + _PART_SUFFIX) if path else None


def is_on_disk(download: GogDownload) -> bool:
    """Completed and actually there at the expected size. A file deleted or truncated
    behind VGT's back counts as not downloaded, so the same button fetches it again."""
    if download.status != GogDownloadStatus.COMPLETED:
        return False
    path = file_path(download)
    if path is None or not path.is_file():
        return False
    return download.total_size <= 0 or path.stat().st_size == download.total_size


# --- reading ---------------------------------------------------------------------------


def list_downloads(db: Session) -> list[GogDownload]:
    return list(
        db.scalars(
            select(GogDownload).options(joinedload(GogDownload.game)).order_by(GogDownload.created_at, GogDownload.id)
        )
    )


def downloads_for_game(db: Session, game_id: int) -> list[GogDownload]:
    return list(db.scalars(select(GogDownload).where(GogDownload.game_id == game_id)))


def get_download(db: Session, download_id: int) -> GogDownload:
    download = db.get(GogDownload, download_id)
    if download is None:
        raise NotFoundError(f"Download {download_id} not found")
    return download


def bytes_on_disk(db: Session) -> int:
    return int(
        db.scalar(
            select(func.coalesce(func.sum(GogDownload.total_size), 0)).where(
                GogDownload.status == GogDownloadStatus.COMPLETED
            )
        )
        or 0
    )


def next_queued(db: Session) -> GogDownload | None:
    return db.scalars(
        select(GogDownload)
        .where(GogDownload.status == GogDownloadStatus.QUEUED)
        .order_by(GogDownload.created_at, GogDownload.id)
    ).first()


def current_status(db: Session, download_id: int) -> str | None:
    """A fresh read of one row's status, or None once it's been deleted (cancelled). The
    download job checks this while streaming, from its own session."""
    return db.scalar(select(GogDownload.status).where(GogDownload.id == download_id))


# --- queueing --------------------------------------------------------------------------


def queue_installer(db: Session, game_id: int, product_id: int, installer: GogInstaller) -> list[GogDownload]:
    """Queues every part of one installer (the .exe and its .bin files belong together).
    A part already on disk stays completed, a queued or running one is left alone, and a
    failed one, or one whose file has gone missing, is queued again."""
    rows: list[GogDownload] = []
    for part in installer.files:
        row = db.scalars(
            select(GogDownload).where(GogDownload.gog_product_id == product_id, GogDownload.file_id == part.id)
        ).first()
        if row is None:
            row = GogDownload(
                game_id=game_id,
                gog_product_id=product_id,
                installer_id=installer.id,
                file_id=part.id,
                total_size=part.size,
                status=GogDownloadStatus.QUEUED,
            )
            db.add(row)
        elif row.status in (GogDownloadStatus.FAILED, GogDownloadStatus.COMPLETED) and not is_on_disk(row):
            _requeue(row, part.size)
        rows.append(row)
    db.commit()
    return rows


def retry(db: Session, download_id: int) -> GogDownload:
    row = get_download(db, download_id)
    if row.status == GogDownloadStatus.FAILED or (row.status == GogDownloadStatus.COMPLETED and not is_on_disk(row)):
        _requeue(row, row.total_size)
        db.commit()
    return row


def _requeue(row: GogDownload, total_size: int) -> None:
    row.status = GogDownloadStatus.QUEUED
    row.downloaded_bytes = 0
    row.error = None
    row.total_size = total_size


def delete(db: Session, download_id: int) -> None:
    """Cancels a queued or running download, or deletes a finished one from the server.
    The row goes first: a running download notices it's gone and stops (see
    gog_jobs._download_one), then the file and any partial file are removed."""
    row = get_download(db, download_id)
    paths = [file_path(row), part_path(row)]
    db.delete(row)
    db.commit()
    _unlink(paths)


def delete_for_game(db: Session, game_id: int) -> None:
    """Every installer downloaded for a game, e.g. once its GOG copy is removed."""
    rows = downloads_for_game(db, game_id)
    paths = [path for row in rows for path in (file_path(row), part_path(row))]
    for row in rows:
        db.delete(row)
    db.commit()
    _unlink(paths)


def _unlink(paths: list[Path | None]) -> None:
    for path in paths:
        if path is None:
            continue
        try:
            path.unlink(missing_ok=True)
        except OSError:
            # Windows won't delete a file the download job still has open; the job removes
            # its own .part file when it notices the cancel.
            continue
        _remove_if_empty(path.parent)


def _remove_if_empty(directory: Path) -> None:
    try:
        if directory.is_dir() and directory != get_downloads_dir() and not any(directory.iterdir()):
            directory.rmdir()
    except OSError:
        pass


def prune_orphan_files(db: Session) -> int:
    """Removes files in the downloads folder that no row accounts for — left behind when
    games are deleted, the library is reset or a backup is restored (those drop the rows
    in bulk). A running download's .part file has a row, so it's kept. Returns how many
    files were removed."""
    root = get_downloads_dir()
    if not root.is_dir():
        return 0
    keep: set[Path] = set()
    for row in db.scalars(select(GogDownload)):
        for path in (file_path(row), part_path(row)):
            if path is not None:
                keep.add(path.resolve())
    removed = 0
    for product_dir in root.iterdir():
        if not product_dir.is_dir():
            continue
        for path in product_dir.iterdir():
            if path.resolve() not in keep:
                if path.is_dir():
                    shutil.rmtree(path, ignore_errors=True)
                else:
                    path.unlink(missing_ok=True)
                removed += 1
        _remove_if_empty(product_dir)
    return removed


# --- the download job's bookkeeping ------------------------------------------------------


def reset_stale(db: Session) -> int:
    """Rows left "downloading" by a restart or crash go back to the queue."""
    stale = list(db.scalars(select(GogDownload).where(GogDownload.status == GogDownloadStatus.DOWNLOADING)))
    for row in stale:
        row.status = GogDownloadStatus.QUEUED
        row.downloaded_bytes = 0
    if stale:
        db.commit()
    return len(stale)
