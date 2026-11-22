import enum
import threading
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qs, urlparse

from sqlalchemy.orm import Session

from app.models.gog import GogDownload, GogDownloadStatus, GogLibraryEntry
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.models.system import User
from app.repositories import (
    game_repository,
    gog_repository,
    gog_wishlist_repository,
    library_item_repository,
    platform_repository,
)
from app.services import gog_download_service, library_service
from app.services.exceptions import ConflictError, NotFoundError
from app.services.gog_client import (
    GogAuthError,
    GogClient,
    GogInstallerFile,
    GogInstallerGroup,
    GogNotConnectedError,
    build_login_url,
)
from app.services.steam_service import PC_IGDB_PLATFORM_ID

GOG_STOREFRONT = "GOG"


class GogEntryStatus(enum.StrEnum):
    # No UPDATE_AVAILABLE, unlike Steam: GOG has no playtime to bring over, so a matched
    # game is either not in the collection as a GOG copy yet (NEW) or already is (UP_TO_DATE).
    NO_MATCH = "no_match"
    NEW = "new"
    UP_TO_DATE = "up_to_date"
    IGNORED = "ignored"


@dataclass
class GogEntryWithStatus:
    entry: GogLibraryEntry
    status: GogEntryStatus


def list_entries(db: Session) -> list[GogEntryWithStatus]:
    """Every cached GOG entry with its status — the GOG Sync table, DLC entries included
    (the page nests them under their parent via game.parent_game_id), and NO_MATCH and
    ignored entries too, like Steam Sync."""
    return [_with_status(db, entry) for entry in gog_repository.list_all_entries(db)]


def sync_entries(db: Session, gog_product_ids: list[int]) -> dict[str, Any]:
    """The explicit, confirmed "Sync" from the GOG Sync page: adds an owned Digital/GOG
    copy for each matched game that doesn't have one. A NO_MATCH or already-synced id is a
    harmless no-op, so a bulk selection never fails on a non-actionable row."""
    synced = 0
    failures: list[dict[str, Any]] = []
    for gog_product_id in gog_product_ids:
        try:
            entry = _require_entry(db, gog_product_id)
            if entry.game_id is not None and entry.game is not None:
                _sync_one(db, entry)
                db.commit()
            synced += 1
        except Exception as exc:  # noqa: BLE001 - one bad id must not abort the batch
            db.rollback()
            failures.append({"gogProductId": gog_product_id, "error": str(exc)})
    return {"synced": synced, "failed": len(failures), "failures": failures}


def ignore_entry(db: Session, gog_product_id: int) -> GogEntryWithStatus:
    return _set_ignored(db, gog_product_id, True)


def unignore_entry(db: Session, gog_product_id: int) -> GogEntryWithStatus:
    """Brings an ignored entry back with its recalculated status. One ignored before IGDB
    matched it stays NO_MATCH until the next Import."""
    return _set_ignored(db, gog_product_id, False)


def ignore_entries(db: Session, gog_product_ids: list[int]) -> dict[str, Any]:
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


def relink_entry(db: Session, gog_product_id: int, game_id: int) -> GogEntryWithStatus:
    """Points an entry at a different game, for when IGDB's GOG mapping is wrong or stale."""
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


def link_custom_game(db: Session, gog_product_id: int, game_id: int) -> None:
    """Best-effort link from "Add as custom game", on the owned or wishlist row it came from
    (whichever exists for that product). A missing or already-claimed entry is a silent
    no-op: linking is a bonus, not a requirement for creating the game. The caller commits."""
    for repository in (gog_repository, gog_wishlist_repository):
        entry = repository.get_entry(db, gog_product_id)
        if entry is not None and entry.game_id is None and repository.get_entry_by_game_id(db, game_id) is None:
            repository.set_game_id(db, entry, game_id)


def _set_ignored(db: Session, gog_product_id: int, ignored: bool) -> GogEntryWithStatus:
    entry = _require_entry(db, gog_product_id)
    gog_repository.set_ignored(db, entry, ignored)
    db.commit()
    return _with_status(db, entry)


def _find_gog_library_item(db: Session, game_id: int) -> LibraryItem | None:
    """The owned copy GOG Sync is responsible for (Digital, storefront GOG), matched on
    format + storefront rather than platform, the same as Steam Sync: a PC copy can be a
    Steam or Epic purchase, and the user may repoint the GOG copy to Mac or Linux."""
    return next(
        (
            item
            for item in library_item_repository.list_library_items(db, game_id, status=LibraryStatus.OWNED)
            if item.format == MediaFormat.DIGITAL and item.digital_storefront == GOG_STOREFRONT
        ),
        None,
    )


def _sync_one(db: Session, entry: GogLibraryEntry) -> None:
    if _find_gog_library_item(db, entry.game_id) is None:
        # PC (Windows) by default, the same as Steam Sync; the user can repoint it later.
        pc_platform = platform_repository.get_or_create_by_igdb(
            db, igdb_id=PC_IGDB_PLATFORM_ID, name="PC (Microsoft Windows)", slug="win", abbreviation="PC"
        )
        library_service.add_library_item(
            db,
            entry.game_id,
            platform_id=pc_platform.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.DIGITAL,
            digital_storefront=GOG_STOREFRONT,
        )

    # Syncing a parent also syncs its DLC/expansion/pack children owned on GOG, one level
    # deep, exactly like Steam Sync.
    for addon in entry.game.addons:
        addon_entry = gog_repository.get_entry_by_game_id(db, addon.id)
        if addon_entry is not None and not addon_entry.dismissed:
            _sync_one(db, addon_entry)


def _with_status(db: Session, entry: GogLibraryEntry) -> GogEntryWithStatus:
    if entry.dismissed:
        return GogEntryWithStatus(entry, GogEntryStatus.IGNORED)
    if entry.game_id is None or entry.game is None:
        return GogEntryWithStatus(entry, GogEntryStatus.NO_MATCH)
    if _find_gog_library_item(db, entry.game_id) is None:
        return GogEntryWithStatus(entry, GogEntryStatus.NEW)
    return GogEntryWithStatus(entry, GogEntryStatus.UP_TO_DATE)


def _require_entry(db: Session, gog_product_id: int) -> GogLibraryEntry:
    entry = gog_repository.get_entry(db, gog_product_id)
    if entry is None:
        raise NotFoundError(f"GOG product {gog_product_id} not found")
    return entry


# ---------------------------------------------------------------------------
# The connected GOG account. The refresh token never leaves the server: the status only
# says whether GOG is connected and as whom.
# ---------------------------------------------------------------------------


def get_status(user: User) -> dict[str, Any]:
    return {
        "connected": bool(user.gog_refresh_token),
        "username": user.gog_username,
        "login_url": build_login_url(),
    }


async def connect(db: Session, user: User, pasted: str) -> User:
    """Swaps the code from GOG's login landing page for tokens and saves the account. The
    user pastes that page's whole address (or just the code). The username is looked up
    once, for display; a failure there never fails the connect."""
    tokens = await GogClient.exchange_code(extract_code(pasted))
    username: str | None = None
    try:
        async with GogClient(
            refresh_token=tokens.refresh_token,
            access_token=tokens.access_token,
            access_token_expires_at=time.time() + tokens.expires_in,
        ) as client:
            username = await client.get_username(tokens.user_id)
    except Exception:  # noqa: BLE001 - display-only, see docstring
        username = None
    user.gog_refresh_token = tokens.refresh_token
    user.gog_user_id = tokens.user_id
    user.gog_username = username
    db.commit()
    db.refresh(user)
    return user


def disconnect(db: Session, user: User) -> User:
    """Forgets the GOG account. Cached entries stay, like Steam's when the SteamID is
    cleared, so reconnecting doesn't lose ignores or relinks."""
    user.gog_refresh_token = None
    user.gog_user_id = None
    user.gog_username = None
    db.commit()
    db.refresh(user)
    return user


def extract_code(pasted: str) -> str:
    """The `code` query parameter of GOG's landing-page address, or the pasted text itself
    when it's a bare code."""
    candidate = (pasted or "").strip()
    if not candidate:
        raise GogAuthError("Paste the address of the page GOG showed after you signed in")
    codes = parse_qs(urlparse(candidate).query).get("code", [])
    if codes:
        return codes[0]
    if "://" in candidate or "?" in candidate:
        raise GogAuthError("That address has no sign-in code — sign in to GOG again and paste the new address")
    return candidate


def client_for_user(user: User) -> GogClient:
    if not user.gog_refresh_token:
        raise GogNotConnectedError("GOG isn't connected yet — connect it in Settings → Integrations")
    return GogClient(refresh_token=user.gog_refresh_token)


def save_rotated_token(db: Session, user: User, client: GogClient) -> None:
    """GOG returns a new refresh token on every refresh, so save it back after any
    authenticated call, or the next call would use a spent one."""
    if client.refresh_token and client.refresh_token != user.gog_refresh_token:
        user.gog_refresh_token = client.refresh_token
        db.commit()


# ---------------------------------------------------------------------------
# Offline installers. Only for games in the collection as an owned GOG copy that came
# through GOG Sync (a matched entry): a game that merely exists on GOG, or is owned on
# Steam, gets nothing here. The listing is cached for a few minutes, so reopening the
# dialog or polling its progress never calls GOG again.
# ---------------------------------------------------------------------------

_INSTALLERS_TTL_SECONDS = 600
_installers_cache: dict[int, tuple[float, list[GogInstallerGroup]]] = {}
_installers_lock = threading.Lock()


def clear_installers_cache() -> None:
    with _installers_lock:
        _installers_cache.clear()


async def list_installer_groups(client: GogClient, product_id: int) -> list[GogInstallerGroup]:
    now = time.monotonic()
    with _installers_lock:
        cached = _installers_cache.get(product_id)
    if cached is not None and cached[0] > now:
        return cached[1]
    groups = await client.get_product_downloads(product_id)
    with _installers_lock:
        _installers_cache[product_id] = (now + _INSTALLERS_TTL_SECONDS, groups)
    return groups


async def find_installer_file(client: GogClient, product_id: int, installer_id: str, file_id: str) -> GogInstallerFile:
    for group in await list_installer_groups(client, product_id):
        if group.product_id != product_id:
            continue
        for installer in group.installers:
            if installer.id == installer_id:
                for part in installer.files:
                    if part.id == file_id:
                        return part
    raise NotFoundError(f"GOG no longer lists installer file {file_id} for product {product_id}")


def require_gog_copy(db: Session, game_id: int) -> GogLibraryEntry:
    entry = gog_repository.get_entry_by_game_id(db, game_id)
    if entry is None or entry.dismissed:
        raise NotFoundError("Offline installers are only for games GOG Sync matched to your GOG library")
    if _find_gog_library_item(db, game_id) is None:
        raise NotFoundError("This game isn't in your collection as a GOG copy yet — sync it on the GOG Sync page")
    return entry


async def get_installers(db: Session, user: User, game_id: int) -> dict[str, Any]:
    """The base game's and each DLC's installers, every part carrying its download state
    on this server, for the Installers dialog."""
    entry = require_gog_copy(db, game_id)
    client = client_for_user(user)
    try:
        groups = await list_installer_groups(client, entry.gog_product_id)
    finally:
        save_rotated_token(db, user, client)
        await client.aclose()
    rows = {(row.gog_product_id, row.file_id): row for row in gog_download_service.downloads_for_game(db, game_id)}
    return {
        "game_id": game_id,
        "groups": [
            {
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
                            _part_state(part.id, part.size, rows.get((group.product_id, part.id)))
                            for part in installer.files
                        ],
                    }
                    for installer in group.installers
                ],
            }
            for group in groups
        ],
    }


async def queue_installer(db: Session, user: User, game_id: int, product_id: int, installer_id: str) -> None:
    entry = require_gog_copy(db, game_id)
    client = client_for_user(user)
    try:
        groups = await list_installer_groups(client, entry.gog_product_id)
    finally:
        save_rotated_token(db, user, client)
        await client.aclose()
    installer = next(
        (
            installer
            for group in groups
            if group.product_id == product_id
            for installer in group.installers
            if installer.id == installer_id
        ),
        None,
    )
    if installer is None:
        raise NotFoundError(f"GOG doesn't list installer {installer_id} for this game")
    gog_download_service.queue_installer(db, game_id, product_id, installer)


def _part_state(file_id: str, size: int, row: GogDownload | None) -> dict[str, Any]:
    if row is None or (row.status == GogDownloadStatus.COMPLETED and not gog_download_service.is_on_disk(row)):
        return {
            "id": file_id,
            "size": size,
            "download_id": None,
            "state": "not_downloaded",
            "downloaded_bytes": 0,
            "error": None,
            "filename": None,
        }
    return {
        "id": file_id,
        "size": row.total_size or size,
        "download_id": row.id,
        "state": row.status,
        "downloaded_bytes": row.downloaded_bytes,
        "error": row.error,
        "filename": row.filename,
    }


def remove_downloads_without_gog_copy(db: Session, game_id: int) -> None:
    """Called after a library copy is deleted: once a game has no owned GOG copy left, its
    downloaded installers go too."""
    if _find_gog_library_item(db, game_id) is None and gog_download_service.downloads_for_game(db, game_id):
        gog_download_service.delete_for_game(db, game_id)
