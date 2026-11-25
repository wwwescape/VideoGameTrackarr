import json
import os
import shutil
import tempfile
import zipfile
from datetime import UTC, date, datetime
from pathlib import Path

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.config import BACKEND_DIR
from app.models.catalog import (
    Artwork,
    Game,
    GameAddonLink,
    GameAlternativeName,
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
from app.models.documents import TOYS_TO_LIFE_KINDS, DocumentFormat, DocumentSource, HardwareDocumentKind
from app.models.game_cases import GameCase
from app.models.gog import GogDownload, GogLibraryEntry, GogWishlistEntry
from app.models.hardware import (
    Accessory,
    AccessoryCompatibility,
    AccessoryType,
    Color,
    Device,
    DeviceType,
    HardwareCondition,
    HardwareDocument,
    HardwarePlatform,
    Manufacturer,
    StorageVariant,
    UserAccessory,
    UserDevice,
)
from app.models.igdb_import import IgdbImportEntry
from app.models.itad import ItadPriceCache
from app.models.labs import LabFeature
from app.models.library import (
    BiosFile,
    GameDocument,
    GameProgress,
    GameTag,
    GuideKind,
    LibraryItem,
    LibraryStatus,
    MediaFormat,
    Note,
    PhysicalContents,
    PlaySession,
    PlayStatus,
    RatingBoard,
    RomFile,
    RomSaveState,
    Tag,
)
from app.models.platprices import PlatPricesCache
from app.models.system import User
from app.models.toys_to_life import (
    ToysToLifeCopy,
    ToysToLifeDocument,
    ToysToLifeItem,
    ToysToLifeNote,
    ToysToLifeTag,
)
from app.schemas.backup import (
    BACKUP_FORMAT_VERSION,
    BackupAccessory,
    BackupAccessoryCompatibility,
    BackupAccessoryType,
    BackupAddonLink,
    BackupBiosFile,
    BackupColor,
    BackupGame,
    BackupGameCaseChoice,
    BackupGameProgress,
    BackupGameTag,
    BackupGameVideo,
    BackupGuide,
    BackupHardware,
    BackupHardwareDocument,
    BackupHardwarePlatform,
    BackupHardwareType,
    BackupIncludedFiles,
    BackupLabFeature,
    BackupLibraryItem,
    BackupManufacturer,
    BackupNote,
    BackupPayload,
    BackupPlatform,
    BackupPlaySession,
    BackupRegion,
    BackupRestoreResult,
    BackupRomFile,
    BackupRomSaveState,
    BackupSalesIgnored,
    BackupSettings,
    BackupStorageVariant,
    BackupTag,
    BackupToysToLifeCopy,
    BackupToysToLifeDocument,
    BackupToysToLifeItem,
    BackupUserAccessory,
    BackupUserHardware,
)
from app.services import (
    document_files,
    gog_download_service,
    rom_service,
    toys_to_life_adoption,
)
from app.services.document_files import GUIDE_STORE, HARDWARE_STORE
from app.services.upload_service import (
    ACCESSORY_IMAGES_DIR,
    ACCESSORY_IMAGES_URL_PREFIX,
    COVERS_DIR,
    COVERS_URL_PREFIX,
    GAME_MEDIA_DIR,
    GAME_MEDIA_URL_PREFIX,
)

BACKUPS_DIR = BACKEND_DIR / "db" / "backups"


def _custom_game_media(db: Session) -> dict[int, tuple[list[str], list[str], list[BackupGameVideo]]]:
    """Custom games' screenshots, artwork and videos by game id, each in display order — one
    query per kind rather than one per game."""
    media: dict[int, tuple[list[str], list[str], list[BackupGameVideo]]] = {}
    custom = select(Game.id).where(Game.igdb_id.is_(None))
    for game_id, url in db.execute(
        select(Screenshot.game_id, Screenshot.url).where(Screenshot.game_id.in_(custom)).order_by(Screenshot.id)
    ):
        media.setdefault(game_id, ([], [], []))[0].append(url)
    for game_id, url in db.execute(
        select(Artwork.game_id, Artwork.url).where(Artwork.game_id.in_(custom)).order_by(Artwork.id)
    ):
        media.setdefault(game_id, ([], [], []))[1].append(url)
    for game_id, name, video_id in db.execute(
        select(GameVideo.game_id, GameVideo.name, GameVideo.video_id)
        .where(GameVideo.game_id.in_(custom))
        .order_by(GameVideo.id)
    ):
        media.setdefault(game_id, ([], [], []))[2].append(BackupGameVideo(name=name, video_id=video_id))
    return media


def build_backup_payload(db: Session, *, roms: bool = False, bios: bool = False) -> BackupPayload:
    """Everything a restore needs. `roms` / `bios` add the rows describing those files, for a
    .zip that carries the files themselves (see export_full_backup_zip)."""
    user = db.scalars(select(User)).first()
    custom_media = _custom_game_media(db)
    no_media: tuple[list[str], list[str], list[BackupGameVideo]] = ([], [], [])
    payload = BackupPayload(
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
                user_rating=g.user_rating,
                screensaver_excluded=g.screensaver_excluded,
                screenshot_urls=custom_media.get(g.id, no_media)[0],
                artwork_urls=custom_media.get(g.id, no_media)[1],
                videos=custom_media.get(g.id, no_media)[2],
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
                target_price=li.target_price,
                steelbook=li.steelbook,
                physical_contents=li.physical_contents.value if li.physical_contents else None,
                media_count=li.media_count,
                format_other=li.format_other,
            )
            for li in db.scalars(select(LibraryItem))
        ],
        game_progress=[
            BackupGameProgress(
                id=gp.id,
                game_id=gp.game_id,
                platform_id=gp.platform_id,
                play_status=gp.play_status.value,
                playtime_minutes=gp.playtime_minutes,
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
                platform_id=ps.platform_id,
                started_at=ps.started_at.isoformat(),
                ended_at=ps.ended_at.isoformat() if ps.ended_at else None,
                duration_minutes=ps.duration_minutes,
                notes=ps.notes,
            )
            for ps in db.scalars(select(PlaySession))
        ],
        notes=[BackupNote(id=n.id, game_id=n.game_id, body=n.body) for n in db.scalars(select(Note))],
        guides=[
            BackupGuide(
                id=g.id,
                game_id=g.game_id,
                name=g.name,
                kind=g.kind.value,
                platform_id=g.platform_id,
                copy_id=g.library_item_id,
                source=g.source.value,
                url=g.url,
                original_filename=g.original_filename,
                stored_filename=g.stored_filename,
                media_format=g.media_format.value if g.media_format else None,
                size_bytes=g.size_bytes,
            )
            for g in db.scalars(select(GameDocument).order_by(GameDocument.id))
        ],
        game_tags=[BackupGameTag(game_id=gt.game_id, tag_id=gt.tag_id) for gt in db.scalars(select(GameTag))],
        hardware_documents=[
            BackupHardwareDocument(
                id=d.id,
                device_id=d.device_id,
                accessory_id=d.accessory_id,
                user_device_id=d.user_device_id,
                user_accessory_id=d.user_accessory_id,
                **_document_file_fields(d),
            )
            for d in db.scalars(select(HardwareDocument).order_by(HardwareDocument.id))
        ],
        addon_links=[
            BackupAddonLink(
                addon_game_id=link.addon_game_id,
                game_id=link.game_id,
                included=link.included,
                preorder_bonus=link.preorder_bonus,
            )
            for link in db.scalars(select(GameAddonLink).order_by(GameAddonLink.id))
        ],
        manufacturers=[BackupManufacturer(id=m.id, name=m.name) for m in db.scalars(select(Manufacturer))],
        hardware_platforms=[BackupHardwarePlatform(id=p.id, name=p.name) for p in db.scalars(select(HardwarePlatform))],
        hardware_types=[BackupHardwareType(id=t.id, name=t.name) for t in db.scalars(select(DeviceType))],
        accessory_types=[BackupAccessoryType(id=t.id, name=t.name) for t in db.scalars(select(AccessoryType))],
        storage_variants=[BackupStorageVariant(id=s.id, name=s.name) for s in db.scalars(select(StorageVariant))],
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
        sales_ignored=[
            *(
                BackupSalesIgnored(provider="itad", game_id=game_id)
                for game_id in db.scalars(select(ItadPriceCache.game_id).where(ItadPriceCache.ignored.is_(True)))
            ),
            *(
                BackupSalesIgnored(provider="platprices", game_id=game_id)
                for game_id in db.scalars(select(PlatPricesCache.game_id).where(PlatPricesCache.ignored.is_(True)))
            ),
        ],
        toys_to_life=_toys_to_life_rows(db),
        lab_features=[BackupLabFeature(id=row.id, enabled=row.enabled) for row in db.scalars(select(LabFeature))],
        game_cases=[
            BackupGameCaseChoice(platform_slug=case.platform_slug, shown=case.shown)
            for case in db.scalars(select(GameCase).order_by(GameCase.platform_slug))
        ],
        settings=(
            BackupSettings(
                currency=user.currency,
                overview_layout=user.overview_layout,
                steam_id_64=user.steam_id_64,
                screensaver_interval_seconds=user.screensaver_interval_seconds,
                screensaver_show_owned=user.screensaver_show_owned,
                screensaver_show_wishlist=user.screensaver_show_wishlist,
                screensaver_include_custom=user.screensaver_include_custom,
            )
            if user
            else None
        ),
    )
    if roms:
        payload.rom_files = [
            BackupRomFile(
                id=r.id,
                library_item_id=r.library_item_id,
                label=r.label,
                original_filename=r.original_filename,
                stored_filename=r.stored_filename,
                size_bytes=r.size_bytes,
                extension=r.extension,
                is_archive=r.is_archive,
                sram_stored_filename=r.sram_stored_filename,
                sram_size_bytes=r.sram_size_bytes,
                sram_updated_at=r.sram_updated_at.isoformat() if r.sram_updated_at else None,
            )
            for r in db.scalars(select(RomFile))
        ]
        payload.rom_save_states = [
            BackupRomSaveState(
                id=s.id,
                rom_file_id=s.rom_file_id,
                stored_filename=s.stored_filename,
                screenshot_filename=s.screenshot_filename,
                screenshot_media_type=s.screenshot_media_type,
                size_bytes=s.size_bytes,
                created_at=s.created_at.isoformat() if s.created_at else None,
            )
            for s in db.scalars(select(RomSaveState))
        ]
    if bios:
        payload.bios_files = [
            BackupBiosFile(
                id=b.id,
                system=b.system,
                filename=b.filename,
                stored_filename=b.stored_filename,
                size_bytes=b.size_bytes,
                md5=b.md5,
            )
            for b in db.scalars(select(BiosFile))
        ]
    return payload


def _restore_labs_and_game_cases(db: Session, payload: BackupPayload) -> None:
    """Labs and each case's Show on shelf choice, from a version-6+ backup. A lab the backup
    doesn't list is off; a case it doesn't list (added to the CSV later) is shown. Cases are
    curated data, so a restore only sets `shown` on the ones this install has."""
    if payload.version < 6:
        return
    db.execute(delete(LabFeature))
    for lab in payload.lab_features:
        db.add(LabFeature(id=lab.id, enabled=lab.enabled))
    choices = {choice.platform_slug: choice.shown for choice in payload.game_cases}
    for case in db.scalars(select(GameCase)):
        case.shown = choices.get(case.platform_slug, True)
    db.flush()


def _toys_to_life_rows(db: Session) -> list[BackupToysToLifeItem]:
    """Only packs that carry some of your own state — the rest is reference data."""
    notes: dict[int, list[str]] = {}
    for note in db.scalars(select(ToysToLifeNote).order_by(ToysToLifeNote.created_at, ToysToLifeNote.id)):
        notes.setdefault(note.item_id, []).append(note.body)
    tag_ids: dict[int, list[int]] = {}
    for link in db.scalars(select(ToysToLifeTag)):
        tag_ids.setdefault(link.item_id, []).append(link.tag_id)
    copies: dict[int, list[BackupToysToLifeCopy]] = {}
    # A copy's position in its pack's list, which is how a document names it.
    copy_index: dict[int, int] = {}
    for copy in db.scalars(select(ToysToLifeCopy).order_by(ToysToLifeCopy.id)):
        item_copies = copies.setdefault(copy.item_id, [])
        copy_index[copy.id] = len(item_copies)
        item_copies.append(BackupToysToLifeCopy(status=copy.status.value, price=copy.price, notes=copy.notes))
    documents: dict[int, list[BackupToysToLifeDocument]] = {}
    for document in db.scalars(select(ToysToLifeDocument).order_by(ToysToLifeDocument.id)):
        documents.setdefault(document.item_id, []).append(
            BackupToysToLifeDocument(
                copy_index=copy_index.get(document.copy_id) if document.copy_id is not None else None,
                **_document_file_fields(document),
            )
        )
    return [
        BackupToysToLifeItem(
            line=item.line,
            set_number=item.set_number,
            copies=copies.get(item.id, []),
            rating=item.user_rating,
            notes=notes.get(item.id, []),
            tag_ids=sorted(tag_ids.get(item.id, [])),
            documents=documents.get(item.id, []),
        )
        for item in db.scalars(select(ToysToLifeItem).order_by(ToysToLifeItem.line, ToysToLifeItem.set_number))
        if item.id in copies
        or item.user_rating is not None
        or item.id in notes
        or item.id in tag_ids
        or item.id in documents
    ]


def _document_file_fields(document) -> dict:
    """The columns every document table shares, as a backup row's fields."""
    return {
        "name": document.name,
        "kind": document.kind.value,
        "source": document.source.value,
        "url": document.url,
        "original_filename": document.original_filename,
        "stored_filename": document.stored_filename,
        "media_format": document.media_format.value if document.media_format else None,
        "size_bytes": document.size_bytes,
    }


def _document_file_columns(row) -> dict | None:
    """A backup document row's shared columns, or None for one that can't be restored (a
    file whose name isn't a plain one we could have written, a link without a URL, an unknown
    source or format). Never takes a rendered copy: a restore rebuilds it."""
    try:
        source = DocumentSource(row.source)
        media_format = DocumentFormat(row.media_format) if source is DocumentSource.FILE and row.media_format else None
    except ValueError:
        return None
    if source is DocumentSource.FILE and not _plain_name(row.stored_filename):
        return None
    if source is DocumentSource.LINK and not row.url:
        return None
    is_file = source is DocumentSource.FILE
    return {
        "name": row.name[: document_files.MAX_NAME_LENGTH] or "Untitled",
        "source": source,
        "url": None if is_file else row.url,
        "original_filename": row.original_filename if is_file else None,
        "stored_filename": row.stored_filename if is_file else None,
        "media_format": media_format,
        "size_bytes": row.size_bytes if is_file else None,
    }


def _restore_toys_to_life(db: Session, rows: list[BackupToysToLifeItem]) -> list[ToysToLifeDocument]:
    """Re-applies your state to the packs by (line, set_number). A pack this install doesn't
    have (a line added after this one was set up) is skipped, as is a tag the backup lacks.
    Returns the restored documents (their files are put back by the caller)."""
    items = {(item.line, item.set_number): item.id for item in db.scalars(select(ToysToLifeItem))}
    tag_ids = set(db.scalars(select(Tag.id)))
    restored_documents: list[ToysToLifeDocument] = []
    for row in rows:
        item_id = items.get((row.line, row.set_number))
        if item_id is None:
            continue
        new_copies = [
            ToysToLifeCopy(item_id=item_id, status=LibraryStatus(copy.status), price=copy.price, notes=copy.notes)
            for copy in row.copies
        ]
        db.add_all(new_copies)
        if row.documents:
            db.flush()  # the copies' new ids, for the documents that name them
        for document_row in row.documents:
            columns = _document_file_columns(document_row)
            try:
                kind = HardwareDocumentKind(document_row.kind)
            except ValueError:
                kind = HardwareDocumentKind.OTHER
            if columns is None:
                continue
            index = document_row.copy_index
            document = ToysToLifeDocument(
                item_id=item_id,
                copy_id=new_copies[index].id if index is not None and 0 <= index < len(new_copies) else None,
                kind=kind if kind in TOYS_TO_LIFE_KINDS else HardwareDocumentKind.OTHER,
                **columns,
            )
            db.add(document)
            restored_documents.append(document)
        if row.rating is not None:
            db.execute(update(ToysToLifeItem).where(ToysToLifeItem.id == item_id).values(user_rating=row.rating))
        for body in row.notes:
            db.add(ToysToLifeNote(item_id=item_id, body=body))
        for tag_id in sorted(set(row.tag_ids) & tag_ids):
            db.add(ToysToLifeTag(item_id=item_id, tag_id=tag_id))
    return restored_documents


def export_backup_json(db: Session) -> str:
    return build_backup_payload(db).model_dump_json(indent=2)


FULL_BACKUP_JSON_NAME = "backup.json"
FULL_BACKUP_FILES_PREFIX = "files/"


FULL_BACKUP_IMAGES_PREFIX = FULL_BACKUP_FILES_PREFIX + "images/"
FULL_BACKUP_GUIDES_PREFIX = FULL_BACKUP_FILES_PREFIX + "guides/"
FULL_BACKUP_DOCUMENTS_PREFIX = FULL_BACKUP_FILES_PREFIX + "documents/"
# Uploaded images by the address prefix they're served under, with the folder they live in.
_IMAGE_FOLDERS = (
    (COVERS_URL_PREFIX, "covers", COVERS_DIR),
    (ACCESSORY_IMAGES_URL_PREFIX, "accessory-images", ACCESSORY_IMAGES_DIR),
    (GAME_MEDIA_URL_PREFIX, "game-media", GAME_MEDIA_DIR),
)


def _rom_file_paths(payload: BackupPayload) -> list[str]:
    paths: list[str] = []
    for rom in payload.rom_files:
        paths.append(rom.stored_filename)
        if rom.sram_stored_filename:
            paths.append(rom.sram_stored_filename)
    for state in payload.rom_save_states:
        paths.append(state.stored_filename)
        if state.screenshot_filename:
            paths.append(state.screenshot_filename)
    return paths


def _bios_file_paths(payload: BackupPayload) -> list[str]:
    return [b.stored_filename for b in payload.bios_files]


def _uploaded_images(payload: BackupPayload) -> list[tuple[str, Path]]:
    """(zip member, file on disk) for every uploaded image the backup's rows point at: custom
    game covers, screenshots and artwork, and accessory photos. IGDB images and hardware
    reference photos are addresses elsewhere, not files here, so they're never in this list. A
    name that isn't a plain file name (a hand-edited backup) is skipped rather than followed."""
    urls = [
        *(g.cover_url for g in payload.games),
        *(url for g in payload.games for url in (*g.screenshot_urls, *g.artwork_urls)),
        *(a.image_url for a in payload.accessories),
    ]
    images: dict[str, Path] = {}
    for url in urls:
        for prefix, folder, directory in _IMAGE_FOLDERS:
            if url and url.startswith(prefix):
                name = url.removeprefix(prefix)
                if name and Path(name).name == name and name not in (".", ".."):
                    images[f"{FULL_BACKUP_IMAGES_PREFIX}{folder}/{name}"] = directory / name
    return list(images.items())


def _plain_name(name: str | None) -> bool:
    return bool(name) and Path(name).name == name and name not in (".", "..")


def _document_file_names(payload: BackupPayload) -> list[str]:
    """Stored names of the payload's device, accessory and Toys-to-Life document files."""
    rows = [*payload.hardware_documents, *(d for item in payload.toys_to_life for d in item.documents)]
    return [d.stored_filename for d in rows if d.source == "file" and _plain_name(d.stored_filename)]


def _guide_file_names(payload: BackupPayload) -> list[str]:
    """Stored names of the payload's guide files — plain file names only (a hand-edited
    backup's anything-else is never followed)."""
    return [g.stored_filename for g in payload.guides if g.source == "file" and _plain_name(g.stored_filename)]


def export_full_backup_zip(
    db: Session,
    *,
    roms: bool = True,
    bios: bool = True,
    images: bool = False,
    guides: bool = True,
    documents: bool = True,
) -> Path:
    """A .zip backup: backup.json plus the files picked — ROMs (with their save states,
    screenshots and in-game saves) and BIOS files under files/<stored path>, uploaded images
    under files/images/<folder>/<name>. Written to a temp file (the caller streams it out and
    deletes it) so memory stays flat however many GB of ROMs there are. Stored, not
    re-compressed: ROMs and images are mostly compressed already, and deflating GBs is slow."""
    payload = build_backup_payload(db, roms=roms, bios=bios)
    payload.included_files = BackupIncludedFiles(
        roms=roms, bios=bios, images=images, guides=guides, documents=documents
    )
    handle, name = tempfile.mkstemp(prefix="vgt-full-backup-", suffix=".zip")
    os.close(handle)
    path = Path(name)
    try:
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
            archive.writestr(
                FULL_BACKUP_JSON_NAME, payload.model_dump_json(indent=2), compress_type=zipfile.ZIP_DEFLATED
            )
            for relative in _rom_file_paths(payload) + _bios_file_paths(payload):
                source = rom_service.rom_dir_path(relative)
                if source.is_file():
                    archive.write(source, FULL_BACKUP_FILES_PREFIX + relative)
            if images:
                for member, source in _uploaded_images(payload):
                    if source.is_file():
                        archive.write(source, member)
            if guides:
                for name in _guide_file_names(payload):
                    source = GUIDE_STORE.safe_path(name)
                    if source.is_file():
                        archive.write(source, FULL_BACKUP_GUIDES_PREFIX + name)
            if documents:
                for name in _document_file_names(payload):
                    source = HARDWARE_STORE.safe_path(name)
                    if source.is_file():
                        archive.write(source, FULL_BACKUP_DOCUMENTS_PREFIX + name)
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    return path


def read_full_backup_zip(path: Path) -> BackupPayload:
    """Parses a full-backup .zip's backup.json (raising ValueError for anything that isn't
    one), leaving the files where they are until restore_backup extracts them."""
    try:
        with zipfile.ZipFile(path) as archive:
            if FULL_BACKUP_JSON_NAME not in archive.namelist():
                raise ValueError("the zip has no backup.json")
            raw = archive.read(FULL_BACKUP_JSON_NAME).decode("utf-8")
    except zipfile.BadZipFile as exc:
        raise ValueError("not a valid zip file") from exc
    return parse_backup_payload(raw)


def write_safety_snapshot(db: Session, label: str = "restore") -> Path:
    """A JSON backup of everything as it is now, saved on the server before something
    replaces or removes it (a restore, a Danger Zone reset) — restorable like any backup."""
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    path = BACKUPS_DIR / f"pre-{label}-{timestamp}.json"
    path.write_text(export_backup_json(db), encoding="utf-8")
    return path


def restore_backup(db: Session, payload: BackupPayload, files_zip: Path | None = None) -> BackupRestoreResult:
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
    safety_snapshot_path = write_safety_snapshot(db)

    # ROM files and their saves aren't part of the backup payload (size), but a same-instance
    # restore shouldn't throw away ROMs that still belong to the same copy afterwards.
    # Snapshot them (and their save states) before the wipe, then re-attach each ROM — with
    # its original id, so its save states still point at it — whose library item id comes
    # back with the same game + platform (ids are preserved, see above) and can still hold a
    # ROM; the rest are deleted, rows and files.
    existing_roms = db.execute(
        select(RomFile, LibraryItem.game_id, LibraryItem.platform_id).join(
            LibraryItem, LibraryItem.id == RomFile.library_item_id
        )
    ).all()
    rom_snapshots = [
        {
            "rom": {
                "id": rom.id,
                "library_item_id": rom.library_item_id,
                "original_filename": rom.original_filename,
                "stored_filename": rom.stored_filename,
                "size_bytes": rom.size_bytes,
                "extension": rom.extension,
                "is_archive": rom.is_archive,
                "label": rom.label,
                "sram_stored_filename": rom.sram_stored_filename,
                "sram_size_bytes": rom.sram_size_bytes,
                "sram_updated_at": rom.sram_updated_at,
            },
            "states": [
                {
                    "id": state.id,
                    "rom_file_id": state.rom_file_id,
                    "stored_filename": state.stored_filename,
                    "screenshot_filename": state.screenshot_filename,
                    "screenshot_media_type": state.screenshot_media_type,
                    "size_bytes": state.size_bytes,
                    "created_at": state.created_at,
                }
                for state in rom.save_states
            ],
            "files": [rom.stored_filename, *rom_service.save_files_of(rom)],
            "game_id": game_id,
            "platform_id": platform_id,
        }
        for rom, game_id, platform_id in existing_roms
    ]
    db.execute(delete(RomSaveState))
    db.execute(delete(RomFile))

    # Hardware side, deepest-children-first — independent of the games tables above, but
    # wiped/restored in the same pass so one backup file covers the whole app. Document rows go
    # now; their files once the restore commits, unless a restored row still uses them.
    db.execute(delete(HardwareDocument))
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
    db.execute(delete(GameAddonLink))
    db.execute(delete(Note))
    db.execute(delete(GameDocument))
    # Toys-to-Life: only your state on the packs goes — the packs are reference data.
    db.execute(delete(ToysToLifeTag))
    db.execute(delete(ToysToLifeNote))
    db.execute(delete(ToysToLifeDocument))
    db.execute(delete(ToysToLifeCopy))
    db.execute(update(ToysToLifeItem).values(user_rating=None))
    # Caches keyed on game ids, which the backup's ids may now point elsewhere: they refetch
    # (the ignored-price choices come back from the backup below).
    db.execute(delete(ItadPriceCache))
    db.execute(delete(PlatPricesCache))
    db.execute(delete(IgdbImportEntry))
    # GOG Sync entries keep their ignores but lose their match (the next Import re-matches
    # them), and the installer download rows go. The GOG account itself is never in a backup.
    db.execute(update(GogLibraryEntry).values(game_id=None))
    db.execute(update(GogWishlistEntry).values(game_id=None))
    db.execute(delete(GogDownload))
    db.execute(delete(PlaySession))
    db.execute(delete(GameProgress))
    db.execute(delete(LibraryItem))
    # Catalog-richness tables (not part of the backup payload itself — see BackupGame's
    # docstring — but they still reference game_id and would otherwise be left as orphans,
    # since a bulk `delete(Game)` doesn't trigger the ORM relationship cascades that
    # `session.delete(some_game_instance)` would).
    db.execute(delete(GameAlternativeName))
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

    # A backup from before the overall rating has ratings per platform instead: each game gets
    # their average, rounded to whole stars (the same rule as the migration that moved them).
    legacy_ratings: dict[int, list[float]] = {}
    for gp in payload.game_progress:
        if gp.rating is not None:
            legacy_ratings.setdefault(gp.game_id, []).append(gp.rating)

    def user_rating_for(g: BackupGame) -> int | None:
        if g.user_rating is not None:
            return g.user_rating
        ratings = legacy_ratings.get(g.id)
        if not ratings:
            return None
        # Half up, like SQL ROUND (Python's round() would make 8.5 an 8).
        return int(sum(ratings) / len(ratings) + 0.5) or None

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
                user_rating=user_rating_for(g),
                screensaver_excluded=g.screensaver_excluded,
            )
        )
    db.flush()
    for g in payload.games:
        # Only a custom game has these (see BackupGame); in order, so ids keep that order.
        db.add_all(Screenshot(game_id=g.id, url=url) for url in g.screenshot_urls)
        db.add_all(Artwork(game_id=g.id, url=url) for url in g.artwork_urls)
        db.add_all(GameVideo(game_id=g.id, name=v.name, video_id=v.video_id) for v in g.videos)

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
                target_price=li.target_price,
                steelbook=li.steelbook,
                physical_contents=PhysicalContents(li.physical_contents) if li.physical_contents else None,
                media_count=li.media_count,
                format_other=li.format_other,
            )
        )
    # platform_id is required now — a backup taken before per-platform Progress has no way
    # to know which platform a row belonged to, so those rows are dropped on restore rather
    # than guessed at (same data-loss tradeoff already accepted for the schema migration).
    for gp in payload.game_progress:
        if gp.platform_id is None:
            continue
        db.add(
            GameProgress(
                id=gp.id,
                game_id=gp.game_id,
                platform_id=gp.platform_id,
                play_status=PlayStatus(gp.play_status),
                playtime_minutes=gp.playtime_minutes,
                review=gp.review,
                started_at=date.fromisoformat(gp.started_at) if gp.started_at else None,
                completed_at=date.fromisoformat(gp.completed_at) if gp.completed_at else None,
                last_played_at=date.fromisoformat(gp.last_played_at) if gp.last_played_at else None,
            )
        )
    for ps in payload.play_sessions:
        if ps.platform_id is None:
            continue
        db.add(
            PlaySession(
                id=ps.id,
                game_id=ps.game_id,
                platform_id=ps.platform_id,
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
    restored_ids = {g.id for g in payload.games}
    restored_guides = _restore_guide_rows(db, payload, restored_ids)
    seen_links: set[tuple[int, int]] = set()
    for link in payload.addon_links:
        pair = (link.addon_game_id, link.game_id)
        # A hand-edited or partial file could name a missing game or repeat a pair.
        if pair in seen_links or not {link.addon_game_id, link.game_id} <= restored_ids:
            continue
        seen_links.add(pair)
        db.add(
            GameAddonLink(
                addon_game_id=link.addon_game_id,
                game_id=link.game_id,
                included=link.included,
                # Never both: Included wins, as on every other write.
                preorder_bonus=link.preorder_bonus and not link.included,
            )
        )
    db.flush()
    restored_toy_documents = _restore_toys_to_life(db, payload.toys_to_life)
    _restore_labs_and_game_cases(db, payload)

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

    restored_documents = [*_restore_hardware_documents(db, payload), *restored_toy_documents]

    restored_game_ids = {g.id for g in payload.games}
    for ignored in payload.sales_ignored:
        if ignored.game_id in restored_game_ids:
            cache = ItadPriceCache if ignored.provider == "itad" else PlatPricesCache
            db.add(cache(game_id=ignored.game_id, ignored=True))
    user = db.scalars(select(User)).first()
    if user is not None and payload.settings is not None:
        user.currency = payload.settings.currency
        user.overview_layout = payload.settings.overview_layout
        user.steam_id_64 = payload.settings.steam_id_64
        user.screensaver_interval_seconds = payload.settings.screensaver_interval_seconds
        # A hand-edited backup can't leave the screensaver with nothing to show.
        user.screensaver_show_owned = payload.settings.screensaver_show_owned or not (
            payload.settings.screensaver_show_wishlist
        )
        user.screensaver_show_wishlist = payload.settings.screensaver_show_wishlist
        user.screensaver_include_custom = payload.settings.screensaver_include_custom

    restored_items = {li.id: li for li in payload.library_items}
    orphaned_rom_files: list[str] = []
    included = _included_files(payload, files_zip)
    if included.roms or included.bios:
        _check_files_present(files_zip, payload, included)
    restored_images = _extract_images(files_zip, payload) if included.images else 0
    restored_guide_files = _extract_guide_files(files_zip, restored_guides) if included.guides else 0
    # Rendered copies are never taken from a backup: rebuild each from its original, whether
    # it just came out of the zip or was already here (a same-instance restore).
    for guide in restored_guides:
        GUIDE_STORE.rebuild_rendered(guide)
    restored_document_files = (
        _extract_document_files(files_zip, restored_documents, HARDWARE_STORE, FULL_BACKUP_DOCUMENTS_PREFIX)
        if included.documents
        else 0
    )
    for document in restored_documents:
        HARDWARE_STORE.rebuild_rendered(document)
    if included.bios:
        # The .zip's BIOS files replace the current ones outright.
        orphaned_rom_files += [b.stored_filename for b in db.scalars(select(BiosFile))]
        db.execute(delete(BiosFile))
        db.flush()
        _extract_files(files_zip, _bios_file_paths(payload))
        for bios in payload.bios_files:
            db.add(
                BiosFile(
                    id=bios.id,
                    system=bios.system,
                    filename=bios.filename,
                    stored_filename=bios.stored_filename,
                    size_bytes=bios.size_bytes,
                    md5=bios.md5,
                )
            )
    if included.roms:
        # The .zip's ROMs and saves replace the current ones outright. Files are extracted
        # before the commit (same stored names are simply rewritten), and any old file the
        # backup doesn't reuse is removed once the new rows are committed.
        old_files = [f for snap in rom_snapshots for f in snap["files"]]
        # Drop rows pointing at copies/ROMs the payload doesn't have (a hand-edited file).
        payload.rom_files = [r for r in payload.rom_files if r.library_item_id in restored_items]
        rom_ids = {r.id for r in payload.rom_files}
        payload.rom_save_states = [s for s in payload.rom_save_states if s.rom_file_id in rom_ids]
        _extract_files(files_zip, _rom_file_paths(payload))
        for rom in payload.rom_files:
            db.add(
                RomFile(
                    id=rom.id,
                    library_item_id=rom.library_item_id,
                    label=rom.label,
                    original_filename=rom.original_filename,
                    stored_filename=rom.stored_filename,
                    size_bytes=rom.size_bytes,
                    extension=rom.extension,
                    is_archive=rom.is_archive,
                    sram_stored_filename=rom.sram_stored_filename,
                    sram_size_bytes=rom.sram_size_bytes,
                    sram_updated_at=datetime.fromisoformat(rom.sram_updated_at) if rom.sram_updated_at else None,
                )
            )
        db.flush()
        for state in payload.rom_save_states:
            db.add(
                RomSaveState(
                    id=state.id,
                    rom_file_id=state.rom_file_id,
                    stored_filename=state.stored_filename,
                    screenshot_filename=state.screenshot_filename,
                    screenshot_media_type=state.screenshot_media_type,
                    size_bytes=state.size_bytes,
                    **({"created_at": datetime.fromisoformat(state.created_at)} if state.created_at else {}),
                )
            )
        kept = set(_rom_file_paths(payload))
        orphaned_rom_files += [f for f in old_files if f not in kept]
        rom_snapshots = []
    if included.bios:
        kept_bios = set(_bios_file_paths(payload))
        orphaned_rom_files = [f for f in orphaned_rom_files if f not in kept_bios]
    for snap in rom_snapshots:
        li = restored_items.get(snap["rom"]["library_item_id"])
        if (
            li is not None
            and li.game_id == snap["game_id"]
            and li.platform_id == snap["platform_id"]
            and rom_service.can_hold_rom(LibraryStatus(li.status), MediaFormat(li.format) if li.format else None)
        ):
            db.add(RomFile(**snap["rom"]))
            db.flush()
            for state in snap["states"]:
                db.add(RomSaveState(**state))
        else:
            orphaned_rom_files.extend(snap["files"])

    # A backup from before format 5 tracked LEGO Dimensions packs as add-ons of the game (and
    # its starter kits through the game's copies); move that onto the packs, as migration
    # d4f6a8c0e2b3 did for the live database.
    if payload.version < 5:
        toys_to_life_adoption.adopt_library_state(db)

    db.commit()
    rom_service.delete_files(orphaned_rom_files)
    # Installer rows don't survive a restore (game ids change), so neither do their files.
    gog_download_service.prune_orphan_files(db)
    # Guide files no restored row uses (replaced by the zip's, or their entry is gone).
    GUIDE_STORE.clear_folder(keep={name for g in restored_guides for name in document_files.filenames_of(g)})
    HARDWARE_STORE.clear_folder(keep={name for d in restored_documents for name in document_files.filenames_of(d)})

    return BackupRestoreResult(
        restored_games=len(payload.games),
        restored_library_items=len(payload.library_items),
        safety_snapshot_path=str(safety_snapshot_path),
        restored_devices=len(payload.user_hardware),
        restored_accessories=len(payload.user_accessories),
        restored_roms=len(payload.rom_files) if included.roms else 0,
        restored_bios_files=len(payload.bios_files) if included.bios else 0,
        restored_images=restored_images,
        restored_guide_files=restored_guide_files,
        restored_document_files=restored_document_files,
    )


def _included_files(payload: BackupPayload, files_zip: Path | None) -> BackupIncludedFiles:
    """Which kinds of files this restore replaces: none for a .json; what the .zip says it
    carries; and ROMs + BIOS files for a version-2 .zip, which always carried both."""
    if files_zip is None:
        return BackupIncludedFiles()
    return payload.included_files or BackupIncludedFiles(roms=True, bios=True)


def _check_files_present(files_zip: Path | None, payload: BackupPayload, included: BackupIncludedFiles) -> None:
    """Fails before anything is written when the .zip lacks a ROM or BIOS file its rows
    name, so a broken zip fails cleanly."""
    assert files_zip is not None
    relatives = (_rom_file_paths(payload) if included.roms else []) + (
        _bios_file_paths(payload) if included.bios else []
    )
    with zipfile.ZipFile(files_zip) as archive:
        present = set(archive.namelist())
    missing = [r for r in relatives if FULL_BACKUP_FILES_PREFIX + r not in present]
    if missing:
        raise ValueError(f"Backup is missing {len(missing)} file(s), e.g. {missing[0]}")


def _extract_files(files_zip: Path | None, relatives: list[str]) -> None:
    """Copies these ROM/BIOS files out of the zip into the private ROM dir. Only names the
    rows reference are read, and every destination goes through rom_service.rom_dir_path,
    which refuses anything outside the ROM dir."""
    assert files_zip is not None
    with zipfile.ZipFile(files_zip) as archive:
        for relative in relatives:
            destination = rom_service.rom_dir_path(relative)
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(FULL_BACKUP_FILES_PREFIX + relative) as source, destination.open("wb") as out:
                shutil.copyfileobj(source, out, 1024 * 1024)


def _restore_guide_rows(db: Session, payload: BackupPayload, restored_game_ids: set[int]) -> list[GameDocument]:
    """Adds the backup's Guides & Cheats rows (ids kept), skipping any whose game isn't in
    the backup or whose file name isn't a plain one we could have written. A platform the
    backup doesn't have is cleared rather than failing the restore."""
    platform_ids = {p.id for p in payload.platforms}
    copies = {li.id: li.game_id for li in payload.library_items}
    guides: list[GameDocument] = []
    for row in payload.guides:
        if row.game_id not in restored_game_ids:
            continue
        source = DocumentSource(row.source)
        if source is DocumentSource.FILE and not _plain_name(row.stored_filename):
            continue
        if source is DocumentSource.LINK and not row.url:
            continue
        guide = GameDocument(
            id=row.id,
            game_id=row.game_id,
            name=row.name[: document_files.MAX_NAME_LENGTH] or "Untitled",
            kind=GuideKind(row.kind),
            platform_id=row.platform_id if row.platform_id in platform_ids else None,
            library_item_id=row.copy_id if row.copy_id is not None and copies.get(row.copy_id) == row.game_id else None,
            source=source,
            url=row.url if source is DocumentSource.LINK else None,
            original_filename=row.original_filename if source is DocumentSource.FILE else None,
            stored_filename=row.stored_filename if source is DocumentSource.FILE else None,
            media_format=DocumentFormat(row.media_format)
            if source is DocumentSource.FILE and row.media_format
            else None,
            size_bytes=row.size_bytes if source is DocumentSource.FILE else None,
        )
        db.add(guide)
        guides.append(guide)
    return guides


def _restore_hardware_documents(db: Session, payload: BackupPayload) -> list[HardwareDocument]:
    """Adds the backup's device and accessory documents (ids kept), skipping any whose owner
    isn't in the backup; a copy that isn't that owner's is cleared rather than failing."""
    devices = {d.id for d in payload.hardware}
    accessories = {a.id for a in payload.accessories}
    device_copies = {u.id: u.hardware_id for u in payload.user_hardware}
    accessory_copies = {u.id: u.accessory_id for u in payload.user_accessories}
    restored: list[HardwareDocument] = []
    for row in payload.hardware_documents:
        columns = _document_file_columns(row)
        if columns is None:
            continue
        try:
            kind = HardwareDocumentKind(row.kind)
        except ValueError:
            kind = HardwareDocumentKind.OTHER
        if row.device_id is not None and row.device_id in devices:
            owner = {
                "device_id": row.device_id,
                "user_device_id": row.user_device_id
                if device_copies.get(row.user_device_id) == row.device_id
                else None,
            }
        elif row.accessory_id is not None and row.accessory_id in accessories:
            owner = {
                "accessory_id": row.accessory_id,
                "user_accessory_id": row.user_accessory_id
                if accessory_copies.get(row.user_accessory_id) == row.accessory_id
                else None,
            }
        else:
            continue
        document = HardwareDocument(id=row.id, kind=kind, **owner, **columns)
        db.add(document)
        restored.append(document)
    return restored


def _extract_document_files(
    files_zip: Path | None, documents: list, store: document_files.DocumentStore, prefix: str
) -> int:
    """Puts back the restored file entries' originals from `prefix` in the zip (files/guides/
    or files/documents/). One the zip doesn't have is left as it is (its entry shows as file
    missing if it isn't here)."""
    assert files_zip is not None
    restored = 0
    with zipfile.ZipFile(files_zip) as archive:
        present = set(archive.namelist())
        for document in documents:
            if document.source is not DocumentSource.FILE or not document.stored_filename:
                continue
            member = prefix + document.stored_filename
            if member not in present:
                continue
            destination = store.safe_path(document.stored_filename)
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member) as source, destination.open("wb") as out:
                shutil.copyfileobj(source, out, 1024 * 1024)
            restored += 1
    return restored


def _extract_guide_files(files_zip: Path | None, guides: list[GameDocument]) -> int:
    """Puts back the restored Guides & Cheats files from files/guides/ in the zip."""
    return _extract_document_files(files_zip, guides, GUIDE_STORE, FULL_BACKUP_GUIDES_PREFIX)


def _extract_images(files_zip: Path | None, payload: BackupPayload) -> int:
    """Puts back the uploaded images the backup's rows point at, from files/images/ in the
    zip (an image the zip doesn't have is left as it is). Returns how many came back."""
    assert files_zip is not None
    restored = 0
    with zipfile.ZipFile(files_zip) as archive:
        present = set(archive.namelist())
        for member, destination in _uploaded_images(payload):
            if member not in present:
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member) as source, destination.open("wb") as out:
                shutil.copyfileobj(source, out, 1024 * 1024)
            restored += 1
    return restored


def parse_backup_payload(raw_json: str) -> BackupPayload:
    return BackupPayload.model_validate(json.loads(raw_json))
