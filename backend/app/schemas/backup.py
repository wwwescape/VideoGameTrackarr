from pydantic import BaseModel, ConfigDict

from app.schemas.base import CamelModel

BACKUP_FORMAT_VERSION = 1


class _BackupRow(BaseModel):
    """Base for the backup file's *internal* row shapes. Deliberately plain snake_case,
    not CamelModel — this is a machine-written/machine-read file format the frontend only
    ever handles as an opaque blob (download/upload), not a parsed API response, so it
    doesn't need to follow the camelCase API-boundary convention."""

    model_config = ConfigDict(extra="ignore")


class BackupPlatform(_BackupRow):
    id: int
    igdb_id: int | None = None
    name: str
    slug: str | None = None
    abbreviation: str | None = None
    logo_url: str | None = None


class BackupRegion(_BackupRow):
    id: int
    name: str


class BackupTag(_BackupRow):
    id: int
    name: str
    color: str | None = None


class BackupGame(_BackupRow):
    # Deliberately covers only base, user-relevant Game columns — not the catalog-richness
    # relations added in M8 (genres/companies/franchises/collections/platforms-as-released-
    # on/screenshots/artworks/videos/release_dates). Those are a cache of IGDB's own catalog
    # data, fully re-derivable with one Resync per game; backup/restore exists to protect
    # data that *isn't* recoverable from anywhere else (the library itself, and everything
    # the user typed: progress, ratings, notes, sessions, tags). A documented scope choice,
    # not an oversight — revisit if richness data ever stops being cheap to re-fetch.
    id: int
    igdb_id: int | None = None
    name: str
    slug: str | None = None
    summary: str | None = None
    storyline: str | None = None
    igdb_url: str | None = None
    first_release_date: int | None = None
    cover_url: str | None = None
    category: str | None = None
    igdb_category_id: int | None = None
    parent_game_id: int | None = None


class BackupLibraryItem(_BackupRow):
    id: int
    game_id: int
    platform_id: int | None = None
    region_id: int | None = None
    status: str
    format: str | None = None
    digital_storefront: str | None = None
    rating_board: str | None = None
    edition: str | None = None
    acquired_at: str | None = None
    notes: str | None = None


class BackupGameProgress(_BackupRow):
    id: int
    game_id: int
    play_status: str
    playtime_minutes: int = 0
    rating: float | None = None
    review: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    last_played_at: str | None = None


class BackupPlaySession(_BackupRow):
    id: int
    game_id: int
    started_at: str
    ended_at: str | None = None
    duration_minutes: int | None = None
    notes: str | None = None


class BackupNote(_BackupRow):
    id: int
    game_id: int
    body: str


class BackupGameTag(_BackupRow):
    game_id: int
    tag_id: int


class BackupManufacturer(_BackupRow):
    id: int
    name: str


class BackupHardwarePlatform(_BackupRow):
    id: int
    name: str


class BackupHardwareType(_BackupRow):
    id: int
    name: str


class BackupAccessoryType(_BackupRow):
    id: int
    name: str


class BackupStorageVariant(_BackupRow):
    id: int
    name: str


class BackupColor(_BackupRow):
    id: int
    name: str


class BackupHardware(_BackupRow):
    id: int
    uuid: str
    manufacturer_id: int
    hardware_platform_id: int | None = None
    hardware_type_id: int
    official_name: str
    model: str | None = None
    revision: str | None = None
    storage_variant_id: int | None = None
    color_id: int | None = None
    external_source: str | None = None
    external_id: str | None = None


class BackupAccessory(_BackupRow):
    id: int
    uuid: str
    manufacturer_id: int
    accessory_type_id: int
    official_name: str
    model: str | None = None
    release_date: int | None = None
    color_id: int | None = None
    image_url: str | None = None
    external_source: str | None = None
    external_id: str | None = None


class BackupAccessoryCompatibility(_BackupRow):
    accessory_id: int
    hardware_platform_id: int


class BackupUserHardware(_BackupRow):
    id: int
    hardware_id: int
    status: str
    condition: str | None = None
    purchase_price: float | None = None
    serial_number: str | None = None
    notes: str | None = None


class BackupUserAccessory(_BackupRow):
    id: int
    accessory_id: int
    status: str
    condition: str | None = None
    purchase_price: float | None = None
    serial_number: str | None = None
    notes: str | None = None


class BackupPayload(_BackupRow):
    version: int
    exported_at: str
    platforms: list[BackupPlatform] = []
    regions: list[BackupRegion] = []
    tags: list[BackupTag] = []
    games: list[BackupGame] = []
    library_items: list[BackupLibraryItem] = []
    game_progress: list[BackupGameProgress] = []
    play_sessions: list[BackupPlaySession] = []
    notes: list[BackupNote] = []
    game_tags: list[BackupGameTag] = []
    manufacturers: list[BackupManufacturer] = []
    hardware_platforms: list[BackupHardwarePlatform] = []
    hardware_types: list[BackupHardwareType] = []
    accessory_types: list[BackupAccessoryType] = []
    storage_variants: list[BackupStorageVariant] = []
    colors: list[BackupColor] = []
    hardware: list[BackupHardware] = []
    accessories: list[BackupAccessory] = []
    accessory_compatibility: list[BackupAccessoryCompatibility] = []
    user_hardware: list[BackupUserHardware] = []
    user_accessories: list[BackupUserAccessory] = []


class BackupRestoreResult(CamelModel):
    restored_games: int
    restored_library_items: int
    safety_snapshot_path: str
