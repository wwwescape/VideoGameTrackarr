import json
from datetime import UTC, date, datetime
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import BACKEND_DIR
from app.models.catalog import (
    Artwork,
    Game,
    GameCategory,
    GameCollection,
    GameCompany,
    GameFranchise,
    GameGenre,
    GamePlatform,
    GameVideo,
    Platform,
    Region,
    ReleaseDate,
    Screenshot,
)
from app.models.hardware import (
    Accessory,
    AccessoryCompatibility,
    AccessoryType,
    Color,
    Device,
    DeviceType,
    HardwareCondition,
    HardwarePlatform,
    Manufacturer,
    StorageVariant,
    UserAccessory,
    UserDevice,
)
from app.models.library import (
    GameProgress,
    GameTag,
    LibraryItem,
    LibraryStatus,
    MediaFormat,
    Note,
    PlaySession,
    PlayStatus,
    RatingBoard,
    Tag,
)
from app.schemas.backup import (
    BACKUP_FORMAT_VERSION,
    BackupAccessory,
    BackupAccessoryCompatibility,
    BackupAccessoryType,
    BackupColor,
    BackupGame,
    BackupGameProgress,
    BackupGameTag,
    BackupHardware,
    BackupHardwarePlatform,
    BackupHardwareType,
    BackupLibraryItem,
    BackupManufacturer,
    BackupNote,
    BackupPayload,
    BackupPlatform,
    BackupPlaySession,
    BackupRegion,
    BackupRestoreResult,
    BackupStorageVariant,
    BackupTag,
    BackupUserAccessory,
    BackupUserHardware,
)

BACKUPS_DIR = BACKEND_DIR / "db" / "backups"


def build_backup_payload(db: Session) -> BackupPayload:
    return BackupPayload(
        version=BACKUP_FORMAT_VERSION,
        exported_at=datetime.now(UTC).isoformat(),
        platforms=[
            BackupPlatform(
                id=p.id, igdb_id=p.igdb_id, name=p.name, slug=p.slug, abbreviation=p.abbreviation, logo_url=p.logo_url
            )
            for p in db.scalars(select(Platform))
        ],
        regions=[BackupRegion(id=r.id, name=r.name) for r in db.scalars(select(Region))],
        tags=[BackupTag(id=t.id, name=t.name, color=t.color) for t in db.scalars(select(Tag))],
        games=[
            BackupGame(
                id=g.id,
                igdb_id=g.igdb_id,
                name=g.name,
                slug=g.slug,
                summary=g.summary,
                storyline=g.storyline,
                igdb_url=g.igdb_url,
                first_release_date=g.first_release_date,
                cover_url=g.cover_url,
                category=g.category.value if g.category else None,
                igdb_category_id=g.igdb_category_id,
                parent_game_id=g.parent_game_id,
            )
            for g in db.scalars(select(Game))
        ],
        library_items=[
            BackupLibraryItem(
                id=li.id,
                game_id=li.game_id,
                platform_id=li.platform_id,
                region_id=li.region_id,
                status=li.status.value,
                format=li.format.value if li.format else None,
                digital_storefront=li.digital_storefront,
                rating_board=li.rating_board.value if li.rating_board else None,
                edition=li.edition,
                acquired_at=li.acquired_at.isoformat() if li.acquired_at else None,
                notes=li.notes,
            )
            for li in db.scalars(select(LibraryItem))
        ],
        game_progress=[
            BackupGameProgress(
                id=gp.id,
                game_id=gp.game_id,
                play_status=gp.play_status.value,
                playtime_minutes=gp.playtime_minutes,
                rating=gp.rating,
                review=gp.review,
                started_at=gp.started_at.isoformat() if gp.started_at else None,
                completed_at=gp.completed_at.isoformat() if gp.completed_at else None,
                last_played_at=gp.last_played_at.isoformat() if gp.last_played_at else None,
            )
            for gp in db.scalars(select(GameProgress))
        ],
        play_sessions=[
            BackupPlaySession(
                id=ps.id,
                game_id=ps.game_id,
                started_at=ps.started_at.isoformat(),
                ended_at=ps.ended_at.isoformat() if ps.ended_at else None,
                duration_minutes=ps.duration_minutes,
                notes=ps.notes,
            )
            for ps in db.scalars(select(PlaySession))
        ],
        notes=[BackupNote(id=n.id, game_id=n.game_id, body=n.body) for n in db.scalars(select(Note))],
        game_tags=[BackupGameTag(game_id=gt.game_id, tag_id=gt.tag_id) for gt in db.scalars(select(GameTag))],
        manufacturers=[BackupManufacturer(id=m.id, name=m.name) for m in db.scalars(select(Manufacturer))],
        hardware_platforms=[
            BackupHardwarePlatform(id=p.id, name=p.name) for p in db.scalars(select(HardwarePlatform))
        ],
        hardware_types=[BackupHardwareType(id=t.id, name=t.name) for t in db.scalars(select(DeviceType))],
        accessory_types=[BackupAccessoryType(id=t.id, name=t.name) for t in db.scalars(select(AccessoryType))],
        storage_variants=[
            BackupStorageVariant(id=s.id, name=s.name) for s in db.scalars(select(StorageVariant))
        ],
        colors=[BackupColor(id=c.id, name=c.name) for c in db.scalars(select(Color))],
        # BackupHardware/BackupUserHardware are the frozen on-disk backup schema names/
        # fields — intentionally not renamed even though the ORM class feeding them
        # (Device/UserDevice) now is. See module docstring note.
        hardware=[
            BackupHardware(
                id=d.id,
                uuid=d.uuid,
                manufacturer_id=d.manufacturer_id,
                hardware_platform_id=d.hardware_platform_id,
                hardware_type_id=d.device_type_id,
                official_name=d.official_name,
                model=d.model,
                revision=d.revision,
                storage_variant_id=d.storage_variant_id,
                color_id=d.color_id,
                external_source=d.external_source,
                external_id=d.external_id,
            )
            for d in db.scalars(select(Device))
        ],
        accessories=[
            BackupAccessory(
                id=a.id,
                uuid=a.uuid,
                manufacturer_id=a.manufacturer_id,
                accessory_type_id=a.accessory_type_id,
                official_name=a.official_name,
                model=a.model,
                release_date=a.release_date,
                color_id=a.color_id,
                image_url=a.image_url,
                external_source=a.external_source,
                external_id=a.external_id,
            )
            for a in db.scalars(select(Accessory))
        ],
        accessory_compatibility=[
            BackupAccessoryCompatibility(accessory_id=c.accessory_id, hardware_platform_id=c.hardware_platform_id)
            for c in db.scalars(select(AccessoryCompatibility))
        ],
        user_hardware=[
            BackupUserHardware(
                id=ud.id,
                hardware_id=ud.device_id,
                status=ud.status.value,
                condition=ud.condition.value if ud.condition else None,
                purchase_price=ud.purchase_price,
                serial_number=ud.serial_number,
                notes=ud.notes,
            )
            for ud in db.scalars(select(UserDevice))
        ],
        user_accessories=[
            BackupUserAccessory(
                id=ua.id,
                accessory_id=ua.accessory_id,
                status=ua.status.value,
                condition=ua.condition.value if ua.condition else None,
                purchase_price=ua.purchase_price,
                serial_number=ua.serial_number,
                notes=ua.notes,
            )
            for ua in db.scalars(select(UserAccessory))
        ],
    )


def export_backup_json(db: Session) -> str:
    return build_backup_payload(db).model_dump_json(indent=2)


def _write_safety_snapshot(db: Session) -> Path:
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    path = BACKUPS_DIR / f"pre-restore-{timestamp}.json"
    path.write_text(export_backup_json(db), encoding="utf-8")
    return path


def restore_backup(db: Session, payload: BackupPayload) -> BackupRestoreResult:
    """Full replace, not merge: a personal single-instance tool has no sensible way to
    "merge" two libraries (which copy of a duplicate game wins?), so restoring a backup
    means "this is now the whole library" — same as restoring any other disaster-recovery
    backup. A safety snapshot of whatever's about to be wiped is taken first, so even a
    destructive restore is itself recoverable.

    IDs are preserved from the backup file (not re-assigned) so cross-table relationships
    (library_items.game_id, etc.) stay intact without remapping. This is correct as-is for
    SQLite, which derives the next autoincrement id from MAX(rowid) and so can't drift out
    of sync. On Postgres, explicit-PK inserts do NOT advance that table's SERIAL sequence,
    so a future plain INSERT could collide with a restored id — SQLite is the primary
    target (see backend/README.md), so this is a known, documented gap rather than a
    silent one if you run this against Postgres.
    """
    safety_snapshot_path = _write_safety_snapshot(db)

    # Hardware side, deepest-children-first — independent of the games tables above, but
    # wiped/restored in the same pass so one backup file covers the whole app.
    db.execute(delete(UserDevice))
    db.execute(delete(UserAccessory))
    db.execute(delete(AccessoryCompatibility))
    db.execute(delete(Device))
    db.execute(delete(Accessory))
    db.execute(delete(Manufacturer))
    db.execute(delete(HardwarePlatform))
    db.execute(delete(DeviceType))
    db.execute(delete(AccessoryType))
    db.execute(delete(StorageVariant))
    db.execute(delete(Color))

    db.execute(delete(GameTag))
    db.execute(delete(Note))
    db.execute(delete(PlaySession))
    db.execute(delete(GameProgress))
    db.execute(delete(LibraryItem))
    # Catalog-richness tables (not part of the backup payload itself — see BackupGame's
    # docstring — but they still reference game_id and would otherwise be left as orphans,
    # since a bulk `delete(Game)` doesn't trigger the ORM relationship cascades that
    # `session.delete(some_game_instance)` would).
    db.execute(delete(GameGenre))
    db.execute(delete(GamePlatform))
    db.execute(delete(GameCompany))
    db.execute(delete(GameFranchise))
    db.execute(delete(GameCollection))
    db.execute(delete(Screenshot))
    db.execute(delete(Artwork))
    db.execute(delete(GameVideo))
    db.execute(delete(ReleaseDate))
    db.execute(delete(Game))
    db.execute(delete(Tag))
    db.execute(delete(Region))
    db.execute(delete(Platform))
    db.flush()

    for p in payload.platforms:
        db.add(
            Platform(
                id=p.id, igdb_id=p.igdb_id, name=p.name, slug=p.slug, abbreviation=p.abbreviation, logo_url=p.logo_url
            )
        )
    for r in payload.regions:
        db.add(Region(id=r.id, name=r.name))
    for t in payload.tags:
        db.add(Tag(id=t.id, name=t.name, color=t.color))
    db.flush()

    for g in payload.games:
        db.add(
            Game(
                id=g.id,
                igdb_id=g.igdb_id,
                name=g.name,
                slug=g.slug,
                summary=g.summary,
                storyline=g.storyline,
                igdb_url=g.igdb_url,
                first_release_date=g.first_release_date,
                cover_url=g.cover_url,
                category=GameCategory(g.category) if g.category else None,
                igdb_category_id=g.igdb_category_id,
                parent_game_id=g.parent_game_id,
            )
        )
    db.flush()

    for li in payload.library_items:
        db.add(
            LibraryItem(
                id=li.id,
                game_id=li.game_id,
                platform_id=li.platform_id,
                region_id=li.region_id,
                status=LibraryStatus(li.status),
                format=MediaFormat(li.format) if li.format else None,
                digital_storefront=li.digital_storefront,
                rating_board=RatingBoard(li.rating_board) if li.rating_board else None,
                edition=li.edition,
                acquired_at=date.fromisoformat(li.acquired_at) if li.acquired_at else None,
                notes=li.notes,
            )
        )
    for gp in payload.game_progress:
        db.add(
            GameProgress(
                id=gp.id,
                game_id=gp.game_id,
                play_status=PlayStatus(gp.play_status),
                playtime_minutes=gp.playtime_minutes,
                rating=gp.rating,
                review=gp.review,
                started_at=date.fromisoformat(gp.started_at) if gp.started_at else None,
                completed_at=date.fromisoformat(gp.completed_at) if gp.completed_at else None,
                last_played_at=date.fromisoformat(gp.last_played_at) if gp.last_played_at else None,
            )
        )
    for ps in payload.play_sessions:
        db.add(
            PlaySession(
                id=ps.id,
                game_id=ps.game_id,
                started_at=datetime.fromisoformat(ps.started_at),
                ended_at=datetime.fromisoformat(ps.ended_at) if ps.ended_at else None,
                duration_minutes=ps.duration_minutes,
                notes=ps.notes,
            )
        )
    for n in payload.notes:
        db.add(Note(id=n.id, game_id=n.game_id, body=n.body))
    for gt in payload.game_tags:
        db.add(GameTag(game_id=gt.game_id, tag_id=gt.tag_id))

    for m in payload.manufacturers:
        db.add(Manufacturer(id=m.id, name=m.name))
    for p in payload.hardware_platforms:
        db.add(HardwarePlatform(id=p.id, name=p.name))
    for t in payload.hardware_types:
        db.add(DeviceType(id=t.id, name=t.name))
    for t in payload.accessory_types:
        db.add(AccessoryType(id=t.id, name=t.name))
    for s in payload.storage_variants:
        db.add(StorageVariant(id=s.id, name=s.name))
    for c in payload.colors:
        db.add(Color(id=c.id, name=c.name))
    db.flush()

    for h in payload.hardware:
        db.add(
            Device(
                id=h.id,
                uuid=h.uuid,
                manufacturer_id=h.manufacturer_id,
                hardware_platform_id=h.hardware_platform_id,
                device_type_id=h.hardware_type_id,
                official_name=h.official_name,
                model=h.model,
                revision=h.revision,
                storage_variant_id=h.storage_variant_id,
                color_id=h.color_id,
                external_source=h.external_source,
                external_id=h.external_id,
            )
        )
    for a in payload.accessories:
        db.add(
            Accessory(
                id=a.id,
                uuid=a.uuid,
                manufacturer_id=a.manufacturer_id,
                accessory_type_id=a.accessory_type_id,
                official_name=a.official_name,
                model=a.model,
                release_date=a.release_date,
                color_id=a.color_id,
                image_url=a.image_url,
                external_source=a.external_source,
                external_id=a.external_id,
            )
        )
    db.flush()

    for c in payload.accessory_compatibility:
        db.add(AccessoryCompatibility(accessory_id=c.accessory_id, hardware_platform_id=c.hardware_platform_id))
    db.flush()

    for uh in payload.user_hardware:
        db.add(
            UserDevice(
                id=uh.id,
                device_id=uh.hardware_id,
                status=LibraryStatus(uh.status),
                condition=HardwareCondition(uh.condition) if uh.condition else None,
                purchase_price=uh.purchase_price,
                serial_number=uh.serial_number,
                notes=uh.notes,
            )
        )
    for ua in payload.user_accessories:
        db.add(
            UserAccessory(
                id=ua.id,
                accessory_id=ua.accessory_id,
                status=LibraryStatus(ua.status),
                condition=HardwareCondition(ua.condition) if ua.condition else None,
                purchase_price=ua.purchase_price,
                serial_number=ua.serial_number,
                notes=ua.notes,
            )
        )

    db.commit()

    return BackupRestoreResult(
        restored_games=len(payload.games),
        restored_library_items=len(payload.library_items),
        safety_snapshot_path=str(safety_snapshot_path),
    )


def parse_backup_payload(raw_json: str) -> BackupPayload:
    return BackupPayload.model_validate(json.loads(raw_json))
