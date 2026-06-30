from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.hardware import (
    Accessory,
    Device,
    HardwarePlatform,
    Manufacturer,
    UserAccessory,
    UserDevice,
)
from app.models.library import LibraryStatus
from app.repositories.accessory_repository import _STATUS_COLUMNS as _ACCESSORY_STATUS_COLUMNS
from app.repositories.accessory_repository import AccessoryWithStatus
from app.repositories.accessory_repository import _row_to_accessory_with_status as _row_to_accessory
from app.repositories.device_repository import _STATUS_COLUMNS as _DEVICE_STATUS_COLUMNS
from app.repositories.device_repository import DeviceWithStatus
from app.repositories.device_repository import _row_to_device_with_status as _row_to_device

BREAKDOWN_LIMIT = 10
RECENT_LIMIT = 8


@dataclass
class NamedCount:
    name: str
    count: int


@dataclass
class RecentlyAddedHardwareItem:
    kind: Literal["device", "accessory"]
    device: DeviceWithStatus | None
    accessory: AccessoryWithStatus | None
    created_at: datetime


@dataclass
class HardwareStatsData:
    owned_consoles: int
    owned_accessories: int
    wishlist_hardware: int
    manufacturer_breakdown: list[NamedCount]
    platform_breakdown: list[NamedCount]
    collection_value: float
    recently_added: list[RecentlyAddedHardwareItem]


def list_recently_added(db: Session) -> list[RecentlyAddedHardwareItem]:
    """Devices/accessories with a recent ownership record (owned or wishlisted — not
    owned-only, mirroring the games dashboard's recently-added). Ordered by a correlated
    MAX(created_at) per catalog row rather than joining UserDevice/UserAccessory into the
    main FROM (same technique as dashboard_repository.py's last_played_subquery), so
    _STATUS_COLUMNS can be reused unchanged and a device/accessory added more than once
    collapses to a single entry — its most recent addition."""
    device_added_at = (
        select(func.max(UserDevice.created_at)).where(UserDevice.device_id == Device.id).scalar_subquery()
    )
    device_stmt = (
        select(Device, *_DEVICE_STATUS_COLUMNS, device_added_at)
        .where(device_added_at.is_not(None))
        .order_by(device_added_at.desc())
        .limit(RECENT_LIMIT)
    )
    items = [
        RecentlyAddedHardwareItem(kind="device", device=_row_to_device(row), accessory=None, created_at=row[-1])
        for row in db.execute(device_stmt)
    ]

    accessory_added_at = (
        select(func.max(UserAccessory.created_at))
        .where(UserAccessory.accessory_id == Accessory.id)
        .scalar_subquery()
    )
    accessory_stmt = (
        select(Accessory, *_ACCESSORY_STATUS_COLUMNS, accessory_added_at)
        .where(accessory_added_at.is_not(None))
        .order_by(accessory_added_at.desc())
        .limit(RECENT_LIMIT)
    )
    items.extend(
        RecentlyAddedHardwareItem(
            kind="accessory", device=None, accessory=_row_to_accessory(row), created_at=row[-1]
        )
        for row in db.execute(accessory_stmt)
    )

    items.sort(key=lambda item: item.created_at, reverse=True)
    return items[:RECENT_LIMIT]


def get_stats(db: Session) -> HardwareStatsData:
    owned_consoles = db.scalar(select(func.count(UserDevice.id)).where(UserDevice.status == LibraryStatus.OWNED))
    owned_accessories = db.scalar(
        select(func.count(UserAccessory.id)).where(UserAccessory.status == LibraryStatus.OWNED)
    )
    wishlist_hardware = db.scalar(
        select(func.count(UserDevice.id)).where(UserDevice.status == LibraryStatus.WISHLIST)
    )

    # Manufacturer/platform distribution mirror the existing games dashboard's
    # platform/genre breakdown: counted across every tracked row (owned + wishlist), not
    # just owned — see dashboard_repository.py's platform_breakdown for the precedent.
    device_by_manufacturer = select(
        Manufacturer.name, func.count(UserDevice.id)
    ).select_from(UserDevice).join(Device, Device.id == UserDevice.device_id).join(
        Manufacturer, Manufacturer.id == Device.manufacturer_id
    ).group_by(Manufacturer.name)
    accessory_by_manufacturer = select(
        Manufacturer.name, func.count(UserAccessory.id)
    ).select_from(UserAccessory).join(Accessory, Accessory.id == UserAccessory.accessory_id).join(
        Manufacturer, Manufacturer.id == Accessory.manufacturer_id
    ).group_by(Manufacturer.name)

    manufacturer_counts: dict[str, int] = {}
    for name, count in db.execute(device_by_manufacturer):
        manufacturer_counts[name] = manufacturer_counts.get(name, 0) + count
    for name, count in db.execute(accessory_by_manufacturer):
        manufacturer_counts[name] = manufacturer_counts.get(name, 0) + count
    manufacturer_breakdown = [
        NamedCount(name=name, count=count)
        for name, count in sorted(manufacturer_counts.items(), key=lambda pair: pair[1], reverse=True)[
            :BREAKDOWN_LIMIT
        ]
    ]

    platform_breakdown = [
        NamedCount(name=name, count=count)
        for name, count in db.execute(
            select(HardwarePlatform.name, func.count(UserDevice.id))
            .select_from(UserDevice)
            .join(Device, Device.id == UserDevice.device_id)
            .join(HardwarePlatform, HardwarePlatform.id == Device.hardware_platform_id)
            .group_by(HardwarePlatform.name)
            .order_by(func.count(UserDevice.id).desc())
            .limit(BREAKDOWN_LIMIT)
        )
    ]

    device_value = db.scalar(
        select(func.coalesce(func.sum(UserDevice.purchase_price), 0)).where(
            UserDevice.status == LibraryStatus.OWNED
        )
    )
    accessory_value = db.scalar(
        select(func.coalesce(func.sum(UserAccessory.purchase_price), 0)).where(
            UserAccessory.status == LibraryStatus.OWNED
        )
    )

    return HardwareStatsData(
        owned_consoles=owned_consoles,
        owned_accessories=owned_accessories,
        wishlist_hardware=wishlist_hardware,
        manufacturer_breakdown=manufacturer_breakdown,
        platform_breakdown=platform_breakdown,
        collection_value=float(device_value) + float(accessory_value),
        recently_added=list_recently_added(db),
    )
