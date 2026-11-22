import asyncio
import time
from collections.abc import Callable
from types import ModuleType
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from app.models.gog import GogDownload, GogDownloadStatus
from app.models.system import User
from app.repositories import game_repository, gog_repository, gog_wishlist_repository
from app.services import game_service, gog_download_service, gog_service, job_registry
from app.services.exceptions import ConflictError, NotFoundError
from app.services.gog_client import GogClient
from app.services.igdb_client import GOG_LOOKUP_BATCH_SIZE, IGDBClient
from app.services.job_registry import JobDefinition, JobRunStatus

JOB_GOG_IMPORT = "gog_import"
JOB_GOG_DOWNLOAD = "gog_download"

# The download job writes progress to the database at most every 8 MB or 2 seconds, and
# checks then whether the row was cancelled.
_DOWNLOAD_CHUNK_BYTES = 1024 * 1024
_PROGRESS_EVERY_BYTES = 8 * 1024 * 1024
_PROGRESS_EVERY_SECONDS = 2.0
# Once the queue looks empty the job waits this long and looks once more, so a download
# queued in that same moment isn't left waiting for the next trigger.
_DRAIN_GRACE_SECONDS = 3.0

# Same pacing as the Steam import: only applies between full IGDB game imports, since the
# GOG -> IGDB lookups themselves are batched.
_PACE_DELAY_SECONDS = 0.5


def run(
    session_factory: Callable[[], Session],
    report_progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    db = session_factory()
    try:
        return asyncio.run(_import(db, report_progress or (lambda current, total: None)))
    finally:
        db.close()


async def _import(db: Session, report_progress: Callable[[int, int], None]) -> dict[str, Any]:
    """Fetches, caches and IGDB-matches the connected account's owned GOG games, then its
    GOG wishlist — nothing more. Like the Steam import, it never writes library items:
    adding a game is always the explicit Sync on the GOG Sync page.

    Entries missing from GOG's response are kept, not pruned: a flaky response must never
    delete the user's ignores and relinks. Only unmatched, non-ignored entries are looked
    up, so a relink or a custom-game link is never overwritten."""
    # VGT has a single admin account (see models.system.User), so the first user is the
    # account GOG is connected on — the same assumption as the Steam import.
    user = db.scalars(select(User)).first()
    if user is None:
        raise gog_service.GogNotConnectedError("GOG isn't connected yet — connect it in Settings → Integrations")

    gog_client = gog_service.client_for_user(user)
    igdb_client = IGDBClient()
    try:
        owned_games = await gog_client.get_owned_library()
        # Saved straight away: the refresh above used up the old token, so a later failure
        # in this run must not leave the account holding a spent one.
        gog_service.save_rotated_token(db, user, gog_client)

        result = await _cache_and_match(
            db, igdb_client, gog_repository, [(game.product_id, game.name) for game in owned_games], report_progress
        )

        # Its own try, like Steam's: a wishlist problem must never hide or undo the owned
        # results already committed above.
        try:
            result["wishlist"] = await _import_wishlist(db, gog_client, igdb_client, report_progress)
        except Exception as exc:  # noqa: BLE001 - see comment above
            result["wishlist"] = {"total": 0, "succeeded": 0, "failed": 0, "failures": [], "error": str(exc)}
        gog_service.save_rotated_token(db, user, gog_client)
        return result
    finally:
        await gog_client.aclose()
        await igdb_client.aclose()


async def _import_wishlist(
    db: Session, gog_client: GogClient, igdb_client: IGDBClient, report_progress: Callable[[int, int], None]
) -> dict[str, Any]:
    product_ids = await gog_client.get_wishlist_ids()
    # GOG's wishlist has ids only. Names come from the public products endpoint, only for
    # entries that don't have a real one yet; a failed lookup just keeps the placeholder.
    needs_name = [
        product_id
        for product_id in product_ids
        if (entry := gog_wishlist_repository.get_entry(db, product_id)) is None
        or entry.gog_name == _placeholder_name(product_id)
    ]
    titles: dict[int, str] = {}
    for start in range(0, len(needs_name), GOG_LOOKUP_BATCH_SIZE):
        try:
            titles.update(await gog_client.get_product_titles(needs_name[start : start + GOG_LOOKUP_BATCH_SIZE]))
        except Exception:  # noqa: BLE001, S112 - names are cosmetic; matching goes by id
            continue

    items: list[tuple[int, str]] = []
    for product_id in product_ids:
        existing = gog_wishlist_repository.get_entry(db, product_id)
        name = titles.get(product_id) or (existing.gog_name if existing else _placeholder_name(product_id))
        items.append((product_id, name))
    return await _cache_and_match(db, igdb_client, gog_wishlist_repository, items, report_progress)


def _placeholder_name(product_id: int) -> str:
    return f"GOG product {product_id}"


async def _cache_and_match(
    db: Session,
    igdb_client: IGDBClient,
    repository: ModuleType,
    items: list[tuple[int, str]],
    report_progress: Callable[[int, int], None],
) -> dict[str, Any]:
    """Upserts each (product id, name) into the given entries table, then matches the
    unmatched, non-ignored ones to IGDB, 50 ids per lookup. Shared by the owned and
    wishlist tables, which have the same repository functions."""
    succeeded = 0
    failures: list[dict[str, Any]] = []
    to_match: list[tuple[int, str]] = []
    for product_id, name in items:
        try:
            entry = repository.upsert_entry(db, product_id, name)
            db.commit()
            if entry.game_id is None and not entry.dismissed:
                to_match.append((product_id, name))
            succeeded += 1
        except Exception as exc:  # noqa: BLE001 - one bad row must not abort the batch
            db.rollback()
            failures.append({"gameId": product_id, "gameName": name, "error": str(exc)})

    total = len(items)
    done = total - len(to_match)
    report_progress(done, total)

    for start in range(0, len(to_match), GOG_LOOKUP_BATCH_SIZE):
        batch = to_match[start : start + GOG_LOOKUP_BATCH_SIZE]
        try:
            igdb_ids = await igdb_client.get_igdb_ids_for_gog_products([product_id for product_id, _ in batch])
        except Exception as exc:  # noqa: BLE001 - one failed lookup batch must not abort the rest
            for product_id, name in batch:
                succeeded -= 1
                failures.append({"gameId": product_id, "gameName": name, "error": str(exc)})
            done += len(batch)
            report_progress(done, total)
            continue

        for product_id, name in batch:
            igdb_id = igdb_ids.get(product_id)
            if igdb_id is not None:
                try:
                    game_id = await _local_game_id(db, igdb_client, igdb_id)
                    entry = repository.get_entry(db, product_id)
                    if entry is not None:
                        repository.set_game_id(db, entry, game_id)
                        db.commit()
                except Exception as exc:  # noqa: BLE001 - one bad import must not abort the batch
                    db.rollback()
                    succeeded -= 1
                    failures.append({"gameId": product_id, "gameName": name, "error": str(exc)})
            done += 1
            report_progress(done, total)

    return {"total": total, "succeeded": succeeded, "failed": len(failures), "failures": failures}


async def _local_game_id(db: Session, igdb_client: IGDBClient, igdb_id: int) -> int:
    """The local game for an IGDB id, importing it (with its DLC/expansion children) first
    when VGT doesn't have it yet. Only a real import is paced."""
    game = game_repository.get_game_by_igdb_id(db, igdb_id)
    if game is None:
        await asyncio.sleep(_PACE_DELAY_SECONDS)
        game = (await game_service.import_game_from_igdb(db, igdb_client, igdb_id)).game
    return game.id


# --- offline installer downloads -----------------------------------------------------------


class DownloadCancelled(Exception):  # noqa: N818 - a signal, not an error
    """The row was deleted while its file was downloading."""


def ensure_download_job_running(session_factory: Callable[[], Session]) -> None:
    """Starts the download job when something is queued and it isn't already running.
    Called after queueing and on every Downloads read, so a row queued just as the job
    was finishing still gets picked up."""
    db = session_factory()
    try:
        if gog_download_service.next_queued(db) is None:
            return
    finally:
        db.close()
    try:
        if job_registry.get_state(JOB_GOG_DOWNLOAD).status == JobRunStatus.RUNNING:
            return
        job_registry.trigger_run(JOB_GOG_DOWNLOAD, session_factory)
    except (NotFoundError, ConflictError, KeyError):
        # Not registered (some tests), or started a moment ago: either way nothing to do.
        return


def run_download(
    session_factory: Callable[[], Session],
    report_progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    db = session_factory()
    try:
        return asyncio.run(_download_queue(db, report_progress or (lambda current, total: None)))
    finally:
        db.close()


async def _download_queue(db: Session, report_progress: Callable[[int, int], None]) -> dict[str, Any]:
    """Works through the queue oldest first, one file at a time, until it's empty. One bad
    file never stops the rest: it's marked failed with the reason. Rows a restart left
    "downloading" go back to the queue first."""
    gog_download_service.reset_stale(db)
    downloaded = 0
    cancelled = 0
    failures: list[dict[str, Any]] = []
    while True:
        row = gog_download_service.next_queued(db)
        if row is None:
            await asyncio.sleep(_DRAIN_GRACE_SECONDS)
            db.expire_all()
            row = gog_download_service.next_queued(db)
            if row is None:
                break
        row_id = row.id
        try:
            await _download_one(db, row, report_progress)
            downloaded += 1
        except DownloadCancelled:
            db.rollback()
            cancelled += 1
        except Exception as exc:  # noqa: BLE001 - one bad file must not stop the queue
            db.rollback()
            failed_row = db.get(GogDownload, row_id)
            if failed_row is not None:
                failed_row.status = GogDownloadStatus.FAILED
                failed_row.error = str(exc)[:500]
                db.commit()
            failures.append({"fileId": row.file_id, "error": str(exc)})
    return {"downloaded": downloaded, "cancelled": cancelled, "failed": len(failures), "failures": failures}


async def _download_one(db: Session, row: GogDownload, report_progress: Callable[[int, int], None]) -> None:
    """Resolves the file's short-lived CDN address, streams it into a .part file next to
    its final name, then renames it into place once the size checks out. A partial file
    never survives a failure or a cancel."""
    user = db.scalars(select(User)).first()
    if user is None:
        raise gog_service.GogNotConnectedError("GOG isn't connected yet — connect it in Settings → Integrations")
    client = gog_service.client_for_user(user)
    try:
        installer_file = await gog_service.find_installer_file(
            client, row.gog_product_id, row.installer_id, row.file_id
        )
        url = await client.resolve_downlink(installer_file.downlink)
    finally:
        gog_service.save_rotated_token(db, user, client)
        await client.aclose()

    row.filename = gog_download_service.filename_from_url(url, f"{row.file_id}.bin")
    row.status = GogDownloadStatus.DOWNLOADING
    row.downloaded_bytes = 0
    row.error = None
    db.commit()
    final_path = gog_download_service.file_path(row)
    tmp_path = gog_download_service.part_path(row)
    final_path.parent.mkdir(parents=True, exist_ok=True)

    # GOG's listed sizes are rounded to the megabyte, so the HTTP Content-Length is the
    # real size whenever the body isn't re-encoded; the body is requested uncompressed so
    # the byte count can be checked against it.
    expected: int | None = None
    total = row.total_size
    written = 0
    last_write_bytes = 0
    last_write_at = time.monotonic()
    try:
        timeout = httpx.Timeout(connect=10.0, read=300.0, write=10.0, pool=10.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as http:
            async with http.stream("GET", url, headers={"Accept-Encoding": "identity"}) as response:
                response.raise_for_status()
                length = int(response.headers.get("content-length") or 0)
                if length > 0 and (response.headers.get("content-encoding") or "identity").lower() == "identity":
                    expected = length
                    total = length
                with open(tmp_path, "wb") as handle:
                    async for chunk in response.aiter_bytes(_DOWNLOAD_CHUNK_BYTES):
                        handle.write(chunk)
                        written += len(chunk)
                        report_progress(written, total)
                        now = time.monotonic()
                        if (
                            written - last_write_bytes >= _PROGRESS_EVERY_BYTES
                            or now - last_write_at >= _PROGRESS_EVERY_SECONDS
                        ):
                            _save_progress(db, row, written)
                            last_write_bytes = written
                            last_write_at = now
        if expected is not None and written != expected:
            raise OSError(f"Downloaded {written} bytes, expected {expected}")
        if gog_download_service.current_status(db, row.id) is None:
            raise DownloadCancelled
        tmp_path.replace(final_path)
        row.downloaded_bytes = written
        row.total_size = written
        row.status = GogDownloadStatus.COMPLETED
        db.commit()
    except BaseException:
        tmp_path.unlink(missing_ok=True)
        raise


def _save_progress(db: Session, row: GogDownload, written: int) -> None:
    """Writes progress, unless the row was deleted from the Downloads list meanwhile."""
    if gog_download_service.current_status(db, row.id) is None:
        raise DownloadCancelled
    row.downloaded_bytes = written
    try:
        db.commit()
    except StaleDataError as exc:
        raise DownloadCancelled from exc


DEFINITION_GOG_IMPORT = JobDefinition(id=JOB_GOG_IMPORT, run=run)
# Not listed in Settings -> Jobs: it only ever runs because something was queued from the
# Installers dialog, and scheduling it would make no sense.
DEFINITION_GOG_DOWNLOAD = JobDefinition(id=JOB_GOG_DOWNLOAD, run=run_download, listed=False)
