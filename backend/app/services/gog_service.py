import enum
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from sqlalchemy.orm import Session

from app.models.gog import GogDownload, GogDownloadStatus, GogLibraryEntry
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.models.system import User
from app.repositories import game_repository, gog_repository, library_item_repository, platform_repository
from app.services import gog_download_service, library_service
from app.services.exceptions import ConflictError, NotFoundError
from app.services.gog_client import (
    GogAuthError,
    GogClient,
    GogInstallerGroup,
    GogNotConfiguredError,
    build_authorize_url,
)

# The platform GOG imports land on — Matthew's library already has it under this
# slug. Resolved by slug first (so an existing curated row is reused), created as
# "GOG Galaxy" (which slugifies to exactly this) only when it doesn't exist yet.
GOG_PLATFORM_SLUG = "gog-galaxy"
GOG_PLATFORM_NAME = "GOG Galaxy"


class GogEntryStatus(enum.StrEnum):
    NO_MATCH = "no_match"
    NEW = "new"
    UP_TO_DATE = "up_to_date"
    IGNORED = "ignored"


@dataclass
class GogEntryWithStatus:
    entry: GogLibraryEntry
    status: GogEntryStatus


def list_entries(db: Session) -> list[GogEntryWithStatus]:
    """Every cached GOG entry with a computed status — the table the GOG Sync page
    renders, DLC/expansion/pack entries included (the page nests them under their matched
    parent's row via each entry's game.parent_game_id). NO_MATCH and ignored entries stay
    visible too, so the user has the complete picture of what GOG has versus what VGT knows."""
    entries = gog_repository.list_all_entries(db)
    return [_with_status(db, entry) for entry in entries]


def sync_entries(db: Session, gog_product_ids: list[int]) -> dict[str, Any]:
    """Explicit, user-confirmed apply of GOG's data to VGT — never called automatically.
    A NO_MATCH id or an already-UP_TO_DATE id is a harmless no-op, not an error, so a bulk
    selection that happens to include a non-actionable row doesn't fail the whole batch."""
    synced = 0
    failures: list[dict[str, Any]] = []
    for gog_product_id in gog_product_ids:
        try:
            entry = gog_repository.get_entry(db, gog_product_id)
            if entry is None:
                raise NotFoundError(f"GOG product {gog_product_id} not found")
            if entry.game_id is not None:
                _sync_one(db, entry)
            synced += 1
        except Exception as exc:  # noqa: BLE001 - one bad id must not abort the batch
            db.rollback()
            failures.append({"gogProductId": gog_product_id, "error": str(exc)})

    return {"synced": synced, "failed": len(failures), "failures": failures}


def ignore_entry(db: Session, gog_product_id: int) -> GogEntryWithStatus:
    return _set_ignored(db, gog_product_id, True)


def unignore_entry(db: Session, gog_product_id: int) -> GogEntryWithStatus:
    """Brings an ignored entry back; the response carries its recalculated status. An entry
    that was ignored before IGDB matched it stays NO_MATCH until the next Import, which only
    matches entries that aren't ignored. Un-ignoring an entry that isn't ignored is a no-op."""
    return _set_ignored(db, gog_product_id, False)


def ignore_entries(db: Session, gog_product_ids: list[int]) -> dict[str, Any]:
    """Bulk Ignore for "Ignore selected" — same per-id failure handling as sync_entries."""
    ignored = 0
    failures: list[dict[str, Any]] = []
    for gog_product_id in gog_product_ids:
        try:
            _set_ignored(db, gog_product_id, True)
            ignored += 1
        except Exception as exc:  # noqa: BLE001 - one bad id must not abort the batch
            db.rollback()
            failures.append({"gogProductId": gog_product_id, "error": str(exc)})

    return {"ignored": ignored, "failed": len(failures), "failures": failures}


def _set_ignored(db: Session, gog_product_id: int, ignored: bool) -> GogEntryWithStatus:
    entry = _require_entry(db, gog_product_id)
    gog_repository.set_ignored(db, entry, ignored)
    db.commit()
    return _with_status(db, entry)


def relink_entry(db: Session, gog_product_id: int, game_id: int) -> GogEntryWithStatus:
    """Repoints an already-matched entry at a different local game — for when the automatic
    GOG-product-id match is wrong or has gone stale (a publisher repurposes an old product
    id for a different release; IGDB's own external_games table can lag behind that
    indefinitely)."""
    entry = _require_entry(db, gog_product_id)
    if game_repository.get_game(db, game_id) is None:
        raise NotFoundError(f"Game {game_id} not found")
    existing = gog_repository.get_entry_by_game_id(db, game_id)
    if existing is not None and existing.gog_product_id != gog_product_id:
        raise ConflictError(f"Game {game_id} is already linked to a different GOG entry")
    gog_repository.set_game_id(db, entry, game_id)
    db.commit()
    return _with_status(db, entry)


def unlink_entry(db: Session, gog_product_id: int) -> GogEntryWithStatus:
    entry = _require_entry(db, gog_product_id)
    gog_repository.set_game_id(db, entry, None)
    db.commit()
    return _with_status(db, entry)


def _find_gog_library_item(db: Session, game_id: int) -> LibraryItem | None:
    """The OWNED library item GOG Sync itself is responsible for (Format: Digital,
    Storefront: GOG) — not merely "owned on PC", since a PC copy can just as easily be a
    Steam/Epic digital purchase or a physical disc that has nothing to do with this GOG
    account. Matching on format+storefront (rather than platform) is also what lets a user
    re-point a GOG entry's platform afterward without it silently looking untracked again
    on the next sync."""
    return next(
        (
            item
            for item in library_item_repository.list_library_items(db, game_id, status=LibraryStatus.OWNED)
            if item.format == MediaFormat.DIGITAL and item.digital_storefront == "GOG"
        ),
        None,
    )


def _gog_platform(db: Session):
    """The gog-galaxy platform, reusing the existing row when the library already has
    it (same lenient pattern as the Steam sync's dedicated "Steam" platform, but
    resolved by slug since that's the stable identifier Matthew named)."""
    platform = platform_repository.get_by_slug_or_id(db, GOG_PLATFORM_SLUG)
    if platform is not None:
        return platform
    platform = platform_repository.get_or_create_by_name(db, GOG_PLATFORM_NAME)
    # Upstream's get_or_create_by_name leaves the slug empty — backfill it so the
    # platform is findable by slug on the next sync (and visible on the Platforms
    # page, which filters out slugless entries).
    if not platform.slug:
        platform.slug = GOG_PLATFORM_SLUG
        db.flush()
    return platform


def _sync_one(db: Session, entry: GogLibraryEntry) -> None:
    gog_item = _find_gog_library_item(db, entry.game_id)
    if gog_item is None:
        # GOG entries sync to the dedicated gog-galaxy platform — the user can repoint
        # its platform afterward like any other library item, and _find_gog_library_item
        # above will keep recognizing it as "the GOG copy" wherever they move it.
        gog_platform = _gog_platform(db)
        library_service.add_library_item(
            db,
            entry.game_id,
            platform_id=gog_platform.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.DIGITAL,
            digital_storefront="GOG",
        )

    # Syncing a parent also syncs any of its DLC/expansion/pack children that are themselves
    # owned on GOG — one level only (Game.addons is already scoped to hierarchical
    # parent_game_id children, and addons don't have addons of their own in this app's
    # model), each addon going through the exact same owned-library-item logic as the
    # parent, just recursively. This still applies even though addons now get their own
    # row in the table too — a bulk "Sync selected" of just the parent should still bring
    # its owned DLC along automatically, same as Steam.
    for addon in entry.game.addons:
        addon_entry = gog_repository.get_entry_by_game_id(db, addon.id)
        if addon_entry is not None and not addon_entry.dismissed:
            _sync_one(db, addon_entry)


def _with_status(db: Session, entry: GogLibraryEntry) -> GogEntryWithStatus:
    if entry.dismissed:
        return GogEntryWithStatus(entry, GogEntryStatus.IGNORED)

    if entry.game_id is None:
        return GogEntryWithStatus(entry, GogEntryStatus.NO_MATCH)

    # GOG exposes no playtime, so there is no "update available" state — a game is
    # either not yet in the collection as a GOG copy (NEW) or already there (UP_TO_DATE).
    if _find_gog_library_item(db, entry.game_id) is None:
        return GogEntryWithStatus(entry, GogEntryStatus.NEW)

    return GogEntryWithStatus(entry, GogEntryStatus.UP_TO_DATE)


def _require_entry(db: Session, gog_product_id: int) -> GogLibraryEntry:
    entry = gog_repository.get_entry(db, gog_product_id)
    if entry is None:
        raise NotFoundError(f"GOG product {gog_product_id} not found")
    return entry


# ---------------------------------------------------------------------------
# Connection (Galaxy client OAuth) — the refresh token lives on the user row,
# stored in plaintext: this codebase has no at-rest encryption for stored
# secrets (the Steam/IGDB keys live in environment variables instead), so a
# GOG refresh token — which grants access to the connected GOG account — is
# only as safe as the database itself. It is never returned to the browser;
# the status endpoint only reports whether GOG is connected and as whom.
# ---------------------------------------------------------------------------


def get_status(user: User) -> dict[str, object]:
    return {
        "configured": bool(user.gog_refresh_token),
        "username": user.gog_username,
        "authorize_url": build_authorize_url(),
    }


async def connect(db: Session, user: User, redirect_url: str) -> User:
    """Exchanges the GOG login redirect for tokens and saves the refresh token. The
    user pastes the full redirect URL (or just the code) from the GOG login page —
    the code is pulled out of its query string here, so a paste of the whole URL
    works. The username is fetched once, with the fresh access token, for display."""
    code = _extract_code(redirect_url)
    tokens = await GogClient.exchange_code(code)
    username: str | None = None
    try:
        async with GogClient(
            refresh_token=tokens.refresh_token,
            access_token=tokens.access_token,
            access_token_expires_at=time.time() + tokens.expires_in,
        ) as client:
            username = await client.get_username(tokens.user_id)
    except Exception:  # noqa: BLE001 - the username is display-only; a failure here must not fail the connect
        username = None
    user.gog_refresh_token = tokens.refresh_token
    user.gog_user_id = tokens.user_id
    user.gog_username = username
    db.commit()
    db.refresh(user)
    return user


def disconnect(db: Session, user: User) -> User:
    user.gog_refresh_token = None
    user.gog_user_id = None
    user.gog_username = None
    db.commit()
    db.refresh(user)
    return user


def _extract_code(redirect_url: str) -> str:
    """The `code` query param of the GOG login redirect — or the pasted value itself
    when it carries no URL (a bare code paste)."""
    candidate = (redirect_url or "").strip()
    if not candidate:
        raise GogAuthError("Paste the redirect URL from the GOG login page (or the code itself)")
    parsed = urlparse(candidate)
    codes = parse_qs(parsed.query).get("code", [])
    if codes:
        return codes[0]
    return candidate


def client_for_user(user: User) -> GogClient:
    refresh_token = user.gog_refresh_token
    if not refresh_token:
        raise GogNotConfiguredError("GOG isn't connected yet — connect it on the Integrations page")
    return GogClient(refresh_token=refresh_token)


def persist_refresh_token(db: Session, user: User, client: GogClient) -> None:
    """The refresh token rotates on every refresh — after any authenticated call,
    save the rotated value back so the next call doesn't reuse a spent token."""
    current = client.refresh_token
    if current and current != user.gog_refresh_token:
        user.gog_refresh_token = current
        db.commit()


# ---------------------------------------------------------------------------
# Offline installers — gated to games imported by the GOG sync: the game must
# have a GOG sync entry (matched) AND an owned GOG library item (actually synced
# into the collection). A game that merely shares an IGDB id with a GOG product
# — imported from Steam, added by hand, or only matched but not yet synced —
# gets no installers here.
# ---------------------------------------------------------------------------


async def get_installers(db: Session, user: User, game_id: int) -> dict[str, Any]:
    """The base game plus each DLC's installers, each file carrying its NAS download
    state (not_downloaded / queued / downloading / completed / failed) so the game
    page can show Download to NAS, a progress bar, or a download-from-NAS link."""
    product_id = _require_imported_product_id(db, game_id)
    async with client_for_user(user) as client:
        groups = await client.get_product_downloads(product_id)
        persist_refresh_token(db, user, client)
    downloads = {
        download.file_id: download
        for download in gog_download_service.list_downloads_for_game(db, game_id)
    }
    return {
        "game_id": game_id,
        "gog_product_id": product_id,
        "groups": [_group_dict(group, downloads) for group in groups],
    }


async def queue_download(
    db: Session, user: User, game_id: int, installer_id: str, file_id: str
) -> dict[str, Any]:
    """Queues one installer file for the NAS drainer job (which does the actual
    download into the uploads volume). The file's size comes from the live GOG
    listing, so the queue row and the progress bar agree on the total."""
    product_id = _require_imported_product_id(db, game_id)
    async with client_for_user(user) as client:
        groups = await client.get_product_downloads(product_id)
        persist_refresh_token(db, user, client)
    total_size = next(
        (
            f.size
            for group in groups
            for installer in group.installers
            for f in installer.files
            if installer.id == installer_id and f.id == file_id
        ),
        None,
    )
    if total_size is None:
        raise NotFoundError(f"No GOG installer file {file_id} for this game")
    download = gog_download_service.create_or_reuse_download(
        db, game_id, product_id, installer_id, file_id, total_size
    )
    return _download_dict(download)


def get_download_file_path(db: Session, game_id: int, file_id: str) -> "Path":
    """The on-disk path of a completed download, for the authenticated file route —
    only when the row is completed AND the file is actually there at the right size.
    Anything else is a 404: the game page offers Download to NAS instead."""
    _require_imported_product_id(db, game_id)
    download = next(
        (d for d in gog_download_service.list_downloads_for_game(db, game_id) if d.file_id == file_id),
        None,
    )
    if download is None or not gog_download_service.verify_completed_file(download):
        raise NotFoundError("That installer hasn't finished downloading to the NAS yet")
    path = gog_download_service.download_file_path(download)
    if path is None:
        raise NotFoundError("That installer hasn't finished downloading to the NAS yet")
    return path


def _download_state(download: "GogDownload | None") -> dict[str, Any]:
    if download is None:
        return {"download_state": "not_downloaded", "downloaded_bytes": 0, "download_error": None}
    if download.status == GogDownloadStatus.COMPLETED and not gog_download_service.verify_completed_file(download):
        # Completed on paper but the file is gone or truncated — offer a fresh download.
        return {"download_state": "not_downloaded", "downloaded_bytes": 0, "download_error": None}
    return {
        "download_state": download.status,
        "downloaded_bytes": download.downloaded_bytes,
        "download_error": download.error,
    }


def _download_dict(download: "GogDownload") -> dict[str, Any]:
    return {
        "file_id": download.file_id,
        "status": download.status,
        "total_size": download.total_size,
        "downloaded_bytes": download.downloaded_bytes,
        "filename": download.filename,
        "error": download.error,
    }


def _require_imported_product_id(db: Session, game_id: int) -> int:
    entry = gog_repository.get_entry_by_game_id(db, game_id)
    if entry is None:
        raise NotFoundError(
            "This game wasn't imported by the GOG sync — installer downloads are only for GOG-imported games"
        )
    if _find_gog_library_item(db, game_id) is None:
        raise NotFoundError(
            "This game isn't in your collection as a GOG copy yet — sync it from the GOG Sync page first"
        )
    return entry.gog_product_id


def _group_dict(group: GogInstallerGroup, downloads: dict[str, GogDownload]) -> dict[str, Any]:
    return {
        "product_id": group.product_id,
        "title": group.title,
        "installers": [
            {
                "id": installer.id,
                "os": installer.os,
                "language": installer.language,
                "version": installer.version,
                "total_size": installer.total_size,
                "files": [
                    {
                        "id": f.id,
                        "size": f.size,
                        **_download_state(downloads.get(f.id)),
                    }
                    for f in installer.files
                ],
            }
            for installer in group.installers
        ],
    }
