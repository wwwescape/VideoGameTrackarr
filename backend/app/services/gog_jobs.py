import asyncio
import time
from collections.abc import Callable
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.catalog import Game
from app.models.gog import GogDownload, GogDownloadStatus
from app.models.system import User
from app.repositories import game_repository, gog_repository
from app.services import game_service, gog_download_service, gog_service, job_registry
from app.services.exceptions import ConflictError, NotFoundError
from app.services.gog_client import GogClient, GogNotConfiguredError
from app.services.igdb_client import EXTERNAL_SOURCE_GOG, IGDBClient
from app.services.job_registry import JobDefinition, JobRunStatus

JOB_GOG_IMPORT = "gog_import"
JOB_GOG_DOWNLOAD = "gog_download"

# The drainer re-checks the queue once after a short grace pause before exiting —
# a queue request landing in the same moment it found an empty queue still gets
# picked up by the same run instead of sitting until the next trigger.
_DOWNLOAD_DRAIN_GRACE_SECONDS = 5.0
# DB progress writes are throttled (every 5 MB or 2 s) so a fast download doesn't
# commit on every 1 MB chunk; the Jobs UI progress bar still moves on every chunk.
_DOWNLOAD_PROGRESS_FLUSH_BYTES = 5 * 1024 * 1024
_DOWNLOAD_PROGRESS_FLUSH_SECONDS = 2.0
_DOWNLOAD_CHUNK_BYTES = 1024 * 1024

# Same pacing as the Steam import: IGDB's free tier allows 4 requests/second, and
# IGDBClient rate-limits request starts to that, so matching can run more imports
# concurrently without tripping 429s. Phase 1 below needs no pacing at all: it only
# upserts rows locally and makes no API calls.
_IGDB_MATCH_CONCURRENCY = 8
# external_games lookups are batched into one query per chunk instead of one per game.
_IGDB_LOOKUP_BATCH_SIZE = 50


def run(
    session_factory: Callable[[], Session],
    report_progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    db = session_factory()
    try:
        return asyncio.run(_import(db, report_progress or (lambda current, total: None)))
    finally:
        db.close()


async def _resolve_igdb_ids(
    igdb_client: IGDBClient, gog_product_ids: list[int]
) -> tuple[dict[int, int], dict[int, str]]:
    """GOG product ids to IGDB ids, in batches. Returns (resolved, failed): an id absent from
    resolved simply has no IGDB match, while a failed id maps to its lookup error — the
    caller records those as failures, the way a per-game lookup failure used to be. A
    failed batch falls back to one lookup per game in it, so one bad id can't sink the
    whole chunk."""
    resolved: dict[int, int] = {}
    failed: dict[int, str] = {}
    for start in range(0, len(gog_product_ids), _IGDB_LOOKUP_BATCH_SIZE):
        chunk = gog_product_ids[start : start + _IGDB_LOOKUP_BATCH_SIZE]
        try:
            resolved.update(await igdb_client.get_igdb_ids_for_external(EXTERNAL_SOURCE_GOG, chunk))
        except Exception:
            for product_id in chunk:
                try:
                    igdb_id = await igdb_client.get_igdb_id_for_external(EXTERNAL_SOURCE_GOG, str(product_id))
                    if igdb_id is not None:
                        resolved[product_id] = igdb_id
                except Exception as exc:
                    failed[product_id] = str(exc)
    return resolved, failed


async def _match_to_igdb(db: Session, igdb_client: IGDBClient, igdb_id: int) -> int:
    """Imports the IGDB game (and its hierarchical DLC/expansion/pack children) if it
    isn't already in VGT, and returns its local Game id. The caller resolves the GOG
    product id to igdb_id first (batched, see _resolve_igdb_ids)."""
    game = game_repository.get_game_by_igdb_id(db, igdb_id)
    if game is None:
        game_with_status = await game_service.import_game_from_igdb(db, igdb_client, igdb_id)
        game = game_with_status.game
    return game.id


async def _import(db: Session, report_progress: Callable[[int, int], None]) -> dict[str, Any]:
    """Fetches + caches + IGDB-matches the user's owned GOG library — nothing more.
    Every run is a full check: phase 1 re-fetches the whole library from GOG, and phase 2
    re-checks every non-dismissed entry against IGDB, matched or not — so a mapping that
    appeared (or changed) since the last import is picked up on the next press of Run Import.
    This job never writes to LibraryItem/GameProgress; applying GOG's data to VGT is always
    a separate, explicit, user-confirmed action (see gog_service.sync_entries), triggered
    from the Settings → GOG Sync page."""
    user = db.scalars(select(User)).first()
    refresh_token = user.gog_refresh_token if user else None
    if not refresh_token:
        raise GogNotConfiguredError(
            "GOG isn't connected yet — connect it in Settings → Integrations."
        )

    # Fresh, short-lived clients rather than any shared instance — same reasoning as
    # steam_jobs.py: this job runs on a plain threading.Thread with no event loop of its
    # own until asyncio.run() creates one here.
    gog_client = GogClient(refresh_token=refresh_token)
    igdb_client = IGDBClient()
    try:
        owned_games = await gog_client.get_owned_library()

        succeeded = 0
        failures: list[dict[str, Any]] = []
        # Phase 1: fast local upserts of every GOG entry (no IGDB calls yet, so no
        # pacing). Cached entries absent from this response are left alone, not pruned:
        # GOG's library endpoint can omit games on a transient failure, so pruning on
        # absence would delete real rows.
        # Full check, every run: phase 2 below re-checks every non-dismissed entry,
        # matched or not, against IGDB. Dismissed entries stay excluded — the user
        # explicitly hid those rows.
        candidates: list[tuple[int, str, int | None]] = []
        for index, gog_game in enumerate(owned_games):
            try:
                entry = gog_repository.upsert_entry(db, gog_game.product_id, gog_game.name)
                if not entry.dismissed:
                    candidates.append((gog_game.product_id, gog_game.name, entry.game_id))
                succeeded += 1
            except Exception as exc:  # noqa: BLE001 - one bad upsert must not abort the batch
                db.rollback()
                failures.append({"gameId": gog_game.product_id, "gameName": gog_game.name, "error": str(exc)})
            report_progress(index + 1, len(owned_games))
        db.commit()

        # Phase 2: full IGDB re-check of every candidate concurrently. Lookups are
        # batched first (one query per 50 ids instead of one per game); only the
        # imports run concurrently, capped by _IGDB_MATCH_CONCURRENCY with IGDBClient's
        # own rate limiting keeping request starts at the free tier's 4/second.
        # Progress is reported per checked game.
        if candidates:
            name_by_product_id = {product_id: name for product_id, name, _ in candidates}
            current_game_by_product_id = {product_id: game_id for product_id, _, game_id in candidates}
            resolved, lookup_failed = await _resolve_igdb_ids(
                igdb_client, [product_id for product_id, _, _ in candidates]
            )
            # A lookup failure for an already-linked game is best-effort only: the
            # existing link and the fresh cache stay valid, so it neither fails the
            # import nor appears in failures. Only unmatched games lose anything.
            for product_id, error in lookup_failed.items():
                if current_game_by_product_id[product_id] is None:
                    succeeded -= 1
                    failures.append(
                        {"gameId": product_id, "gameName": name_by_product_id[product_id], "error": error}
                    )
            # Current IGDB id of each already-linked game, in one query — the re-link
            # decision below compares against it.
            linked_game_ids = {game_id for game_id in current_game_by_product_id.values() if game_id is not None}
            igdb_by_game_id: dict[int, int | None] = {}
            if linked_game_ids:
                rows = db.execute(select(Game.id, Game.igdb_id).where(Game.id.in_(linked_game_ids))).all()
                igdb_by_game_id = dict(rows)
            semaphore = asyncio.Semaphore(_IGDB_MATCH_CONCURRENCY)
            matched = 0

            async def _match_one(product_id: int, game_name: str, current_game_id: int | None) -> None:
                nonlocal succeeded, matched
                async with semaphore:
                    try:
                        igdb_id = resolved.get(product_id)
                        if current_game_id is None:
                            if igdb_id is None:
                                return  # no IGDB match — the entry stays cached, unmatched
                            game_id = await _match_to_igdb(db, igdb_client, igdb_id)
                        else:
                            current_igdb_id = igdb_by_game_id.get(current_game_id)
                            # Only IGDB-sourced links are revisited. A link to a custom
                            # game (no igdb_id) is the user's explicit choice and is
                            # never overwritten, and a mapping that vanished never
                            # unmatches a good link.
                            if current_igdb_id is None or igdb_id is None or igdb_id == current_igdb_id:
                                return
                            game_id = await _match_to_igdb(db, igdb_client, igdb_id)
                        entry = gog_repository.get_entry(db, product_id)
                        if entry is not None:
                            gog_repository.set_game_id(db, entry, game_id)
                            db.commit()
                    except Exception as exc:  # noqa: BLE001 - one bad match must not abort the batch
                        db.rollback()
                        if current_game_id is None:
                            # Phase 1 already counted this game as succeeded — a Phase 2
                            # IGDB failure means the import actually failed for it.
                            succeeded -= 1
                            failures.append({"gameId": product_id, "gameName": game_name, "error": str(exc)})
                        # For an already-linked game the old link survives a failed
                        # re-link, so it is not an import failure — just a re-check
                        # that didn't land this run.
                    finally:
                        matched += 1
                        report_progress(matched, len(candidates))

            await asyncio.gather(
                *(_match_one(product_id, name, game_id) for product_id, name, game_id in candidates)
            )

        # The refresh token rotates on every refresh — persist the rotated value so
        # the next run doesn't reuse a spent token.
        if gog_client.refresh_token and gog_client.refresh_token != refresh_token:
            user.gog_refresh_token = gog_client.refresh_token
            db.commit()

        return {
            "total": len(owned_games),
            "succeeded": succeeded,
            "failed": len(failures),
            "failures": failures,
        }
    finally:
        await gog_client.aclose()
        await igdb_client.aclose()


DEFINITION_GOG_IMPORT = JobDefinition(id=JOB_GOG_IMPORT, run=run)


def ensure_download_job_running(db: Session, session_factory: Callable[[], Session]) -> None:
    """Triggers the download drainer when rows are queued and it isn't already running —
    called from the queue endpoint and the installers read, so a row queued in the same
    moment the drainer found an empty queue still gets picked up."""
    if gog_download_service.next_queued_download(db) is None:
        return
    try:
        state = job_registry.get_state(JOB_GOG_DOWNLOAD)
    except NotFoundError:
        return  # job not registered (tests that don't register jobs)
    if state.status == JobRunStatus.RUNNING:
        return
    try:
        job_registry.trigger_run(JOB_GOG_DOWNLOAD, session_factory)
    except ConflictError:
        pass  # started between the state check and the trigger — the running drainer picks the row up


def run_download(
    session_factory: Callable[[], Session],
    report_progress: Callable[[int, int], None] | None = None,
) -> dict[str, Any]:
    db = session_factory()
    try:
        return asyncio.run(_download_drain(db, report_progress or (lambda current, total: None)))
    finally:
        db.close()


async def _download_drain(db: Session, report_progress: Callable[[int, int], None]) -> dict[str, Any]:
    """Works the gog_downloads queue oldest-first, one file at a time, until it is
    empty — then one grace re-check, so a queue request landing in the same moment
    the queue looked empty still gets picked up by this run. One bad file never
    aborts the drain: it is marked failed and the next queued file downloads.
    Rows left "downloading" by a restart or crash are reset to queued up front."""
    gog_download_service.reset_stale_downloads(db)
    downloaded = 0
    failures: list[dict[str, Any]] = []
    while True:
        row = gog_download_service.next_queued_download(db)
        if row is None:
            await asyncio.sleep(_DOWNLOAD_DRAIN_GRACE_SECONDS)
            row = gog_download_service.next_queued_download(db)
            if row is None:
                break
        try:
            await _download_one(db, row, report_progress)
            downloaded += 1
        except Exception as exc:  # noqa: BLE001 - one bad file must not abort the drain
            db.rollback()
            gog_download_service.set_status(
                db, row, GogDownloadStatus.FAILED, error=str(exc)[:512]
            )
            failures.append({"fileId": row.file_id, "error": str(exc)})
    return {"downloaded": downloaded, "failed": len(failures), "failures": failures}


async def _download_one(
    db: Session, row: GogDownload, report_progress: Callable[[int, int], None]
) -> None:
    """Downloads one queued installer file to the NAS: resolves its downlink at
    download time (the CDN URL is time-limited and never stored), streams it to a
    .part file in uploads/gog-installers/<product id>/, then renames it into place
    and verifies the size. A partial file is deleted on failure."""
    user = db.scalars(select(User)).first()
    if user is None:
        raise GogNotConfiguredError("No user account found.")
    client = gog_service.client_for_user(user)
    try:
        groups = await client.get_product_downloads(row.gog_product_id)
        downlink = next(
            (
                f.downlink
                for group in groups
                for installer in group.installers
                for f in installer.files
                if installer.id == row.installer_id and f.id == row.file_id
            ),
            None,
        )
        if downlink is None:
            raise NotFoundError(f"No GOG installer file {row.file_id} for this game")
        url = await client.resolve_downlink(downlink)
    finally:
        gog_service.persist_refresh_token(db, user, client)
        await client.aclose()

    filename = gog_download_service.filename_from_url(url, f"{row.file_id}.bin")
    gog_download_service.set_filename(db, row, filename)
    gog_download_service.set_status(db, row, GogDownloadStatus.DOWNLOADING)
    target_dir = gog_download_service.get_downloads_dir() / str(row.gog_product_id)
    target_dir.mkdir(parents=True, exist_ok=True)
    final_path = target_dir / filename
    tmp_path = target_dir / f"{filename}.part"
    # GOG's API file sizes are rounded to whole megabytes, so the queued total is
    # only an estimate — the served file is up to ~1 MB bigger, and exact-matching
    # against it fails every download. Trust the HTTP layer instead: ask for the
    # file uncompressed (httpx would otherwise transparently decode a gzipped
    # response, so the decoded byte count overshoots the Content-Length), and treat
    # Content-Length as authoritative only when nothing re-encoded the body. A
    # completed stream with no usable Content-Length is accepted as-is, and the
    # row's total is corrected to the bytes actually written, so the on-disk
    # verification and the UI agree on the true size afterwards.
    total = row.total_size
    expected_size: int | None = None
    downloaded_bytes = 0
    last_flush_bytes = 0
    last_flush_at = time.monotonic()
    try:
        timeout = httpx.Timeout(connect=10.0, read=300.0, write=10.0, pool=10.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as http:
            async with http.stream("GET", url, headers={"Accept-Encoding": "identity"}) as response:
                response.raise_for_status()
                content_length = int(response.headers.get("content-length", 0))
                content_encoding = (response.headers.get("content-encoding") or "").lower()
                if content_length > 0 and content_encoding in ("", "identity"):
                    expected_size = content_length
                    total = expected_size
                with open(tmp_path, "wb") as handle:
                    async for chunk in response.aiter_bytes(_DOWNLOAD_CHUNK_BYTES):
                        handle.write(chunk)
                        downloaded_bytes += len(chunk)
                        report_progress(downloaded_bytes, total)
                        now = time.monotonic()
                        if (
                            downloaded_bytes - last_flush_bytes >= _DOWNLOAD_PROGRESS_FLUSH_BYTES
                            or now - last_flush_at >= _DOWNLOAD_PROGRESS_FLUSH_SECONDS
                        ):
                            gog_download_service.set_progress(db, row, downloaded_bytes)
                            last_flush_bytes = downloaded_bytes
                            last_flush_at = now
        if expected_size is not None and downloaded_bytes != expected_size:
            raise OSError(f"Downloaded {downloaded_bytes} bytes, expected {expected_size}")
        tmp_path.replace(final_path)
        gog_download_service.set_progress(db, row, downloaded_bytes)
        gog_download_service.set_total_size(db, row, downloaded_bytes)
        gog_download_service.set_status(db, row, GogDownloadStatus.COMPLETED)
    except BaseException:
        tmp_path.unlink(missing_ok=True)
        raise


DEFINITION_GOG_DOWNLOAD = JobDefinition(id=JOB_GOG_DOWNLOAD, run=run_download)
