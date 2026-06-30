from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.catalog import Game, GameGenre, Genre, Platform
from app.models.hardware import Accessory, Device, HardwareReferenceEntry
from app.models.library import GameProgress, LibraryItem, LibraryStatus
from app.repositories.accessory_repository import _STATUS_COLUMNS as _ACCESSORY_STATUS_COLUMNS
from app.repositories.accessory_repository import AccessoryWithStatus
from app.repositories.accessory_repository import _owned_exists as _accessory_owned_exists
from app.repositories.accessory_repository import _row_to_accessory_with_status as _row_to_accessory
from app.repositories.accessory_repository import _wishlisted_exists as _accessory_wishlisted_exists
from app.repositories.device_repository import _STATUS_COLUMNS as _DEVICE_STATUS_COLUMNS
from app.repositories.device_repository import DeviceWithStatus
from app.repositories.device_repository import _owned_exists as _device_owned_exists
from app.repositories.device_repository import _row_to_device_with_status as _row_to_device
from app.repositories.device_repository import _wishlisted_exists as _device_wishlisted_exists
from app.repositories.game_repository import (
    GameWithStatus,
    _is_browsable_game,
    _owned_exists,
    _play_status_subquery,
    _rating_subquery,
    _row_to_game_with_status,
    _wishlisted_exists,
)

RECENT_LIMIT = 8
BREAKDOWN_LIMIT = 10


@dataclass
class NamedCount:
    name: str
    count: int


@dataclass
class DashboardStatsData:
    total_owned: int
    total_wishlisted: int
    total_tracked: int
    total_playtime_minutes: int
    average_rating: float | None
    play_status_breakdown: dict[str, int]
    platform_breakdown: list[NamedCount]
    genre_breakdown: list[NamedCount]
    recently_added: list[GameWithStatus]
    recently_played: list[GameWithStatus]


def get_stats(db: Session) -> DashboardStatsData:
    total_owned = db.scalar(
        select(func.count(func.distinct(LibraryItem.game_id))).where(LibraryItem.status == LibraryStatus.OWNED)
    ) or 0
    total_wishlisted = db.scalar(
        select(func.count(func.distinct(LibraryItem.game_id))).where(LibraryItem.status == LibraryStatus.WISHLIST)
    ) or 0
    total_tracked = (
        db.scalar(
            select(func.count(Game.id)).where(Game.parent_game_id.is_(None), _is_browsable_game(Game.category))
        )
        or 0
    )
    total_playtime_minutes = db.scalar(select(func.coalesce(func.sum(GameProgress.playtime_minutes), 0))) or 0
    average_rating = db.scalar(select(func.avg(GameProgress.rating)).where(GameProgress.rating.is_not(None)))

    play_status_breakdown = {
        status.value: count
        for status, count in db.execute(
            select(GameProgress.play_status, func.count(GameProgress.id)).group_by(GameProgress.play_status)
        )
    }

    platform_breakdown = [
        NamedCount(name=name, count=count)
        for name, count in db.execute(
            select(Platform.name, func.count(func.distinct(LibraryItem.game_id)))
            .join(LibraryItem, LibraryItem.platform_id == Platform.id)
            .group_by(Platform.name)
            .order_by(func.count(func.distinct(LibraryItem.game_id)).desc())
            .limit(BREAKDOWN_LIMIT)
        )
    ]

    genre_breakdown = [
        NamedCount(name=name, count=count)
        for name, count in db.execute(
            select(Genre.name, func.count(func.distinct(GameGenre.game_id)))
            .join(GameGenre, GameGenre.genre_id == Genre.id)
            .group_by(Genre.name)
            .order_by(func.count(func.distinct(GameGenre.game_id)).desc())
            .limit(BREAKDOWN_LIMIT)
        )
    ]

    recently_added_stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .where(Game.parent_game_id.is_(None), _is_browsable_game(Game.category))
        .order_by(Game.created_at.desc())
        .limit(RECENT_LIMIT)
    )
    recently_added = [_row_to_game_with_status(row) for row in db.execute(recently_added_stmt)]

    # Filtering/ordering by last_played_at through a correlated scalar subquery (rather
    # than joining GameProgress into the main FROM) keeps this consistent with
    # _play_status_subquery/_rating_subquery above — joining the same table they
    # implicitly reference would make SQLAlchemy auto-correlate it away entirely.
    last_played_subquery = select(GameProgress.last_played_at).where(GameProgress.game_id == Game.id).scalar_subquery()
    recently_played_stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .where(last_played_subquery.is_not(None))
        .order_by(last_played_subquery.desc())
        .limit(RECENT_LIMIT)
    )
    recently_played = [_row_to_game_with_status(row) for row in db.execute(recently_played_stmt)]

    return DashboardStatsData(
        total_owned=total_owned,
        total_wishlisted=total_wishlisted,
        total_tracked=total_tracked,
        total_playtime_minutes=total_playtime_minutes,
        average_rating=average_rating,
        play_status_breakdown=play_status_breakdown,
        platform_breakdown=platform_breakdown,
        genre_breakdown=genre_breakdown,
        recently_added=recently_added,
        recently_played=recently_played,
    )


def list_upcoming_releases(db: Session, now: datetime) -> list[GameWithStatus]:
    """Owned/wishlisted games (top-level only) with a future first_release_date — almost
    always wishlisted titles, since you'd only own something already released, but not
    restricted to wishlist-only in case a pre-order or early-access title is marked owned
    ahead of its full release."""
    now_ts = int(now.timestamp())
    stmt = (
        select(
            Game,
            _owned_exists(Game.id),
            _wishlisted_exists(Game.id),
            _play_status_subquery(Game.id),
            _rating_subquery(Game.id),
        )
        .where(
            Game.parent_game_id.is_(None),
            _is_browsable_game(Game.category),
            Game.first_release_date.is_not(None),
            Game.first_release_date > now_ts,
            _owned_exists(Game.id) | _wishlisted_exists(Game.id),
        )
        .order_by(Game.first_release_date.asc())
    )
    return [_row_to_game_with_status(row) for row in db.execute(stmt)]


@dataclass
class UpcomingHardwareRelease:
    kind: Literal["device", "accessory"]
    device: DeviceWithStatus | None
    accessory: AccessoryWithStatus | None
    release_date: date


def _parse_reference_release_date(value: str | None) -> date | None:
    """HardwareReferenceEntry.release_date is free text — mixes year-only strings ("1994")
    with full ISO dates ("1985-10-18"). Tries a full parse first, falls back to treating a
    bare year as Jan 1 of that year, and gives up (None) on anything else."""
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        pass
    try:
        return date(int(value), 1, 1)
    except (ValueError, TypeError):
        return None


def list_upcoming_hardware_releases(db: Session, today: date) -> list[UpcomingHardwareRelease]:
    """Owned/wishlisted devices and accessories with a future release date. Devices have no
    release_date column of their own — every device is predefined (no custom-device mode),
    so a device's release date always comes from its linked HardwareReferenceEntry. Accessory
    keeps its own real release_date column for Custom Accessory; predefined (reference-linked)
    accessories fall back to the same reference-table lookup as devices. Unlike Game's
    first_release_date (a unix timestamp comparable directly in SQL), the reference table's
    release_date is free text, so those rows are fetched unfiltered-by-date and the date
    comparison happens in Python after parsing."""
    releases: list[UpcomingHardwareRelease] = []

    device_stmt = (
        select(Device, *_DEVICE_STATUS_COLUMNS, HardwareReferenceEntry.release_date)
        .join(HardwareReferenceEntry, Device.hardware_reference_entry_id == HardwareReferenceEntry.id)
        .where(_device_owned_exists(Device.id) | _device_wishlisted_exists(Device.id))
    )
    for row in db.execute(device_stmt):
        release_date = _parse_reference_release_date(row[-1])
        if release_date is not None and release_date > today:
            releases.append(
                UpcomingHardwareRelease(
                    kind="device", device=_row_to_device(row), accessory=None, release_date=release_date
                )
            )

    accessory_stmt = select(Accessory, *_ACCESSORY_STATUS_COLUMNS).where(
        Accessory.release_date.is_not(None),
        Accessory.release_date > today.year,
        _accessory_owned_exists(Accessory.id) | _accessory_wishlisted_exists(Accessory.id),
    )
    releases.extend(
        UpcomingHardwareRelease(
            kind="accessory",
            device=None,
            accessory=_row_to_accessory(row),
            release_date=date(row[0].release_date, 1, 1),
        )
        for row in db.execute(accessory_stmt)
    )

    accessory_ref_stmt = (
        select(Accessory, *_ACCESSORY_STATUS_COLUMNS, HardwareReferenceEntry.release_date)
        .join(HardwareReferenceEntry, Accessory.hardware_reference_entry_id == HardwareReferenceEntry.id)
        .where(
            Accessory.release_date.is_(None),
            _accessory_owned_exists(Accessory.id) | _accessory_wishlisted_exists(Accessory.id),
        )
    )
    for row in db.execute(accessory_ref_stmt):
        release_date = _parse_reference_release_date(row[-1])
        if release_date is not None and release_date > today:
            releases.append(
                UpcomingHardwareRelease(
                    kind="accessory", device=None, accessory=_row_to_accessory(row), release_date=release_date
                )
            )

    releases.sort(key=lambda item: item.release_date)
    return releases
