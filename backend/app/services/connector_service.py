import hashlib
import secrets
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.catalog import Game, GameCategory, Platform
from app.models.connector import (
    Connector,
    ConnectorAbsentMode,
    ConnectorDevice,
    ConnectorGame,
    ConnectorKind,
    ConnectorPairing,
)
from app.models.igdb_import import IgdbImportEntry
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.repositories import connector_repository, game_repository, library_item_repository
from app.services import igdb_import_jobs, job_registry, library_service, manual_game_service, nintendo_titledb
from app.services.exceptions import ConflictError, NotFoundError
from app.services.igdb_client import EXTERNAL_SOURCE_EPIC, EXTERNAL_SOURCE_GOG, IGDBClient
from app.services.igdb_import_service import normalize_name
from app.services.store_clients import EpicClient, GogClient, StoreLoginError, code_from_paste

PAIRING_LIFETIME = timedelta(minutes=10)
# No 0/O or 1/I: a code is read off one screen and typed on another.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
# Where a connector's player counts land when IGDB has none (see players_fill_jobs.py).
FALLBACK_SOURCE_NINTENDO = "nintendo"
FALLBACK_SOURCE_CONNECTOR = "connector"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _new_code() -> str:
    letters = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))
    return f"{letters[:4]}-{letters[4:]}"


def _require(db: Session, connector_id: int) -> Connector:
    connector = connector_repository.get_connector(db, connector_id)
    if connector is None:
        raise NotFoundError(f"Connector {connector_id} not found")
    return connector


def require_by_slug(db: Session, slug: str) -> Connector:
    connector = connector_repository.get_connector_by_slug(db, slug)
    if connector is None:
        raise NotFoundError(f"Connector {slug} not found")
    return connector


def list_connectors(db: Session) -> list[Connector]:
    return connector_repository.list_connectors(db)


def create_connector(db: Session, **fields: Any) -> Connector:
    if connector_repository.get_connector_by_slug(db, fields["slug"]) is not None:
        raise ConflictError(f"A connector already uses {fields['slug']}")
    connector = Connector(**fields)
    db.add(connector)
    db.commit()
    db.refresh(connector)
    return connector


def update_connector(db: Session, connector_id: int, **fields: Any) -> Connector:
    """Every field but its kind, which decides how a device talks to it."""
    connector = _require(db, connector_id)
    other = connector_repository.get_connector_by_slug(db, fields["slug"])
    if other is not None and other.id != connector.id:
        raise ConflictError(f"A connector already uses {fields['slug']}")
    for key, value in fields.items():
        setattr(connector, key, value)
    db.commit()
    db.refresh(connector)
    return connector


def delete_connector(db: Session, connector_id: int) -> None:
    """Its devices stop working at once; the games and copies it added stay in the library."""
    db.delete(_require(db, connector_id))
    db.commit()


def revoke_device(db: Session, connector_id: int, device_id: int) -> None:
    device = db.get(ConnectorDevice, device_id)
    if device is None or device.connector_id != connector_id:
        raise NotFoundError(f"Device {device_id} not found")
    db.delete(device)
    db.commit()


# --- Pairing: the device asks, someone signed in approves its code, the device polls ---


def start_pairing(db: Session, slug: str, device_name: str) -> tuple[ConnectorPairing, str]:
    """A pairing code for the device to show, and the poll token it keeps to itself."""
    connector = require_by_slug(db, slug)
    now = datetime.now(UTC)
    connector_repository.delete_expired_pairings(db, now)
    code = _new_code()
    while connector_repository.get_pairing_by_code(db, code) is not None:
        code = _new_code()
    poll_token = secrets.token_urlsafe(32)
    pairing = ConnectorPairing(
        connector_id=connector.id,
        code=code,
        poll_token_hash=hash_token(poll_token),
        device_name=device_name,
        expires_at=now + PAIRING_LIFETIME,
    )
    db.add(pairing)
    db.commit()
    return pairing, poll_token


def get_pairing(db: Session, code: str) -> tuple[ConnectorPairing, Connector]:
    """A pairing still waiting for approval, by the code its device shows."""
    pairing = connector_repository.get_pairing_by_code(db, code.strip().upper())
    if pairing is None or pairing.approved or pairing.expires_at < datetime.now(UTC):
        raise NotFoundError("This code is unknown or has expired")
    return pairing, _require(db, pairing.connector_id)


def approve_pairing(db: Session, code: str) -> ConnectorDevice:
    pairing, connector = get_pairing(db, code)
    token = secrets.token_urlsafe(32)
    device = ConnectorDevice(connector_id=connector.id, name=pairing.device_name, token_hash=hash_token(token))
    db.add(device)
    pairing.approved = True
    pairing.device_token = token
    db.commit()
    return device


def poll_pairing(db: Session, slug: str, poll_token: str) -> tuple[str, str | None]:
    """("pending" | "approved" | "expired", the device token on the first poll after
    approval). The token is handed over once, then forgotten."""
    connector = require_by_slug(db, slug)
    pairing = connector_repository.get_pairing_by_poll_token_hash(db, connector.id, hash_token(poll_token))
    if pairing is None or pairing.expires_at < datetime.now(UTC):
        return "expired", None
    if not pairing.approved:
        return "pending", None
    token = pairing.device_token
    db.delete(pairing)
    db.commit()
    return "approved", token


def authenticate_device(db: Session, slug: str, token: str) -> tuple[Connector, ConnectorDevice]:
    connector = require_by_slug(db, slug)
    device = connector_repository.get_device_by_token_hash(db, connector.id, hash_token(token))
    if device is None:
        raise PermissionError("Unknown device token")
    device.last_seen_at = datetime.now(UTC)
    db.commit()
    return connector, device


# --- Sync ---


@dataclass
class ReportedGame:
    # The connector's own id for the game (a Switch title ID, a launcher's id, the name...).
    external_id: str
    name: str | None = None
    igdb_id: int | None = None
    # Most players on one screen, when the device knows it.
    players: int | None = None


@dataclass
class SyncResult:
    added: int = 0
    existing: int = 0
    absent: int = 0
    unknown: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {"added": self.added, "existing": self.existing, "absent": self.absent, "unknown": self.unknown}


def _absent_note(connector: Connector) -> str:
    return f"No longer reported by {connector.name}."


def _set_note(item: LibraryItem, note: str, present: bool) -> None:
    lines = [line for line in (item.notes or "").splitlines() if line != note]
    if present:
        lines.append(note)
    item.notes = "\n".join(lines) or None


def _resolve(connector: Connector, reported: ReportedGame) -> ReportedGame | None:
    """Fills in what an NX Remote Launcher device leaves out: the name and player count of
    the title ID it sends. A title the Nintendo title database doesn't know is skipped
    unless the device named it."""
    if connector.kind != ConnectorKind.NX_REMOTE_LAUNCHER:
        return reported if reported.name else None
    title = nintendo_titledb.get_title(reported.external_id)
    if title is None and not reported.name:
        return None
    return ReportedGame(
        external_id=reported.external_id.upper(),
        name=reported.name or title.name,
        igdb_id=reported.igdb_id,
        players=reported.players or (title.players if title else None),
    )


def _find_or_create_game(
    db: Session, connector: Connector, reported: ReportedGame, by_name: dict[str, int], platform: Platform | None
) -> tuple[Game, bool]:
    """The library's game for what the device reported — by IGDB id, then by name — or a new
    custom game, which IGDB Import then matches (or links straight away when the device gave
    its IGDB id). Returns whether it's new."""
    if reported.igdb_id is not None:
        game = game_repository.get_game_by_igdb_id(db, reported.igdb_id)
        if game is not None:
            return game, False
    game_id = by_name.get(normalize_name(reported.name or ""))
    if game_id is not None:
        return db.get(Game, game_id), False
    detail = manual_game_service.create_manual_game(
        db,
        name=reported.name,
        category=GameCategory.MAIN_GAME,
        first_release_date=None,
        summary=None,
        storyline=None,
        edition=None,
        cover_url=None,
        platform_names=[platform.name] if platform else None,
    )
    game = detail.game
    by_name[normalize_name(game.name)] = game.id
    if reported.igdb_id is not None:
        db.add(
            IgdbImportEntry(
                game_id=game.id,
                match_igdb_id=reported.igdb_id,
                match_name=reported.name,
                exact_match_count=1,
                checked_at=datetime.now(UTC),
                queued=True,
            )
        )
    return game, True


def _find_or_create_copy(db: Session, connector: Connector, game: Game) -> LibraryItem:
    """The game's copy on the connector's platform (and storefront, for a digital one) —
    so games already in the library by hand or from another sync aren't doubled."""
    status = LibraryStatus.WISHLIST if connector.wishlist else LibraryStatus.OWNED
    digital = connector.media_format == MediaFormat.DIGITAL.value
    for item in library_item_repository.list_library_items(db, game.id):
        same_store = not digital or (item.digital_storefront or "") == (connector.digital_storefront or "")
        if item.platform_id == connector.platform_id and same_store:
            return item
    return library_item_repository.create_library_item(
        db,
        game_id=game.id,
        platform_id=connector.platform_id,
        status=status,
        format=MediaFormat(connector.media_format) if connector.media_format else None,
        digital_storefront=connector.digital_storefront if digital else None,
    )


def _record_players(game: Game, connector: Connector, players: int | None) -> None:
    if players and game.local_players is None and game.local_players_fallback is None:
        game.local_players_fallback = players
        nintendo = connector.kind == ConnectorKind.NX_REMOTE_LAUNCHER
        game.local_players_fallback_source = FALLBACK_SOURCE_NINTENDO if nintendo else FALLBACK_SOURCE_CONNECTOR


def sync(
    db: Session,
    connector: Connector,
    games: list[ReportedGame],
    complete: bool,
    session_factory: Callable[[], Session] | None = None,
) -> SyncResult:
    """Adds what's new to the library with the connector's defaults and keeps track of it.
    A complete sync (the device's whole list) also handles what it no longer reports, per
    the connector's absent mode; a partial one only adds. New custom games are then matched
    by IGDB Import's jobs, in the background."""
    result = SyncResult()
    known = connector_repository.games_by_external_id(db, connector.id)
    by_name = {normalize_name(name): game_id for game_id, name in db.execute(select(Game.id, Game.name))}
    platform = db.get(Platform, connector.platform_id) if connector.platform_id else None
    seen: set[str] = set()
    new_custom = queued = False
    for raw in games:
        reported = _resolve(connector, raw)
        if reported is None:
            result.unknown.append(raw.external_id)
            continue
        seen.add(reported.external_id)
        entry = known.get(reported.external_id)
        game = db.get(Game, entry.game_id) if entry and entry.game_id else None
        created = False
        if game is None:
            game, created = _find_or_create_game(db, connector, reported, by_name, platform)
            new_custom |= created and reported.igdb_id is None
            queued |= created and reported.igdb_id is not None
        item = db.get(LibraryItem, entry.library_item_id) if entry and entry.library_item_id else None
        if item is None:
            item = _find_or_create_copy(db, connector, game)
        _set_note(item, _absent_note(connector), present=False)
        _record_players(game, connector, reported.players)
        if entry is None:
            entry = ConnectorGame(connector_id=connector.id, external_id=reported.external_id, name=reported.name)
            db.add(entry)
            known[reported.external_id] = entry
        entry.name, entry.game_id, entry.library_item_id, entry.present = reported.name, game.id, item.id, True
        if created:
            result.added += 1
        else:
            result.existing += 1
        db.flush()

    if complete:
        for external_id, entry in known.items():
            if external_id in seen or not entry.present:
                continue
            entry.present = False
            result.absent += 1
            item = db.get(LibraryItem, entry.library_item_id) if entry.library_item_id else None
            if item is None:
                continue
            if connector.absent_mode == ConnectorAbsentMode.NOTE:
                _set_note(item, _absent_note(connector), present=True)
            elif connector.absent_mode == ConnectorAbsentMode.REMOVE:
                entry.library_item_id = None
                db.flush()
                library_service.delete_library_item(db, item.id)

    connector.last_sync_at = datetime.now(UTC)
    connector.last_sync_result = result.as_dict()
    db.commit()

    if session_factory is not None:
        for job_id, needed in ((igdb_import_jobs.JOB_IGDB_LINK, queued), (igdb_import_jobs.JOB_IGDB_MATCH, new_custom)):
            if needed:
                try:
                    job_registry.trigger_run(job_id, session_factory)
                except ConflictError:
                    pass  # Already running; it'll be picked up on the next run.
    return result


# --- Store connectors (Epic, GOG): the app reads the library itself ---


def _store_client(connector: Connector) -> EpicClient | GogClient:
    if connector.kind == ConnectorKind.EPIC:
        return EpicClient()
    if connector.kind == ConnectorKind.GOG:
        return GogClient()
    raise ConflictError(f"{connector.name} isn't a store connector")


def login_url(db: Session, connector_id: int) -> str:
    connector = _require(db, connector_id)
    if connector.kind == ConnectorKind.EPIC:
        return EpicClient.LOGIN_URL
    if connector.kind == ConnectorKind.GOG:
        return GogClient.LOGIN_URL
    raise ConflictError(f"{connector.name} isn't a store connector")


async def sign_in(db: Session, connector_id: int, pasted: str) -> Connector:
    """Exchanges what the store's sign-in page gave (the code, its JSON or its final URL)
    for a refresh token, kept on the connector."""
    connector = _require(db, connector_id)
    client = _store_client(connector)
    try:
        code = code_from_paste(pasted, "authorizationCode" if connector.kind == ConnectorKind.EPIC else "code")
        session = await client.start_session(code=code)
    finally:
        await client.aclose()
    connector.credentials = {"refresh_token": session.refresh_token}
    db.commit()
    db.refresh(connector)
    return connector


async def pull(
    db: Session, connector: Connector, igdb_client: IGDBClient, session_factory: Callable[[], Session] | None = None
) -> SyncResult:
    """Reads the store account's games and syncs them like a device would, as a complete
    list. Each new game is looked up on IGDB by its store id first (external_games), so most
    link straight away instead of waiting on a name search."""
    if not connector.credentials:
        raise StoreLoginError(f"{connector.name} isn't signed in")
    client = _store_client(connector)
    try:
        session = await client.start_session(refresh_token=connector.credentials["refresh_token"])
        connector.credentials = {"refresh_token": session.refresh_token}
        db.commit()
        owned = await client.owned_games(session.access_token)
    finally:
        await client.aclose()
    known = connector_repository.games_by_external_id(db, connector.id)
    source = EXTERNAL_SOURCE_EPIC if connector.kind == ConnectorKind.EPIC else EXTERNAL_SOURCE_GOG
    reported: list[ReportedGame] = []
    for game in owned:
        igdb_id = None
        if game.id not in known or known[game.id].game_id is None:
            igdb_id = await igdb_client.get_igdb_id_for_external(source, game.id)
        reported.append(ReportedGame(external_id=game.id, name=game.title, igdb_id=igdb_id))
    return sync(db, connector, reported, complete=True, session_factory=session_factory)


def import_games(
    db: Session, connector_id: int, games: list[ReportedGame], session_factory: Callable[[], Session] | None = None
) -> SyncResult:
    """A CSV connector's rows: only adds (a file is rarely the whole list)."""
    connector = _require(db, connector_id)
    if connector.kind != ConnectorKind.CSV:
        raise ConflictError(f"{connector.name} isn't a CSV connector")
    return sync(db, connector, games, complete=False, session_factory=session_factory)
