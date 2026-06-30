from typing import Literal

from app.repositories.hardware_stats_repository import HardwareStatsData, RecentlyAddedHardwareItem
from app.schemas.accessory import AccessorySummaryResponse, accessory_summary_from_orm
from app.schemas.base import CamelModel
from app.schemas.device import DeviceSummaryResponse, device_summary_from_orm


class NamedCountResponse(CamelModel):
    name: str
    count: int


class RecentlyAddedHardwareResponse(CamelModel):
    kind: Literal["device", "accessory"]
    device: DeviceSummaryResponse | None = None
    accessory: AccessorySummaryResponse | None = None


class HardwareStatsResponse(CamelModel):
    owned_consoles: int
    owned_accessories: int
    wishlist_hardware: int
    manufacturer_distribution: list[NamedCountResponse]
    platform_distribution: list[NamedCountResponse]
    collection_value: float
    recently_added: list[RecentlyAddedHardwareResponse]


def _recently_added_from_item(item: RecentlyAddedHardwareItem) -> RecentlyAddedHardwareResponse:
    return RecentlyAddedHardwareResponse(
        kind=item.kind,
        device=device_summary_from_orm(item.device) if item.device else None,
        accessory=accessory_summary_from_orm(item.accessory) if item.accessory else None,
    )


def hardware_stats_from_data(data: HardwareStatsData) -> HardwareStatsResponse:
    return HardwareStatsResponse(
        owned_consoles=data.owned_consoles,
        owned_accessories=data.owned_accessories,
        wishlist_hardware=data.wishlist_hardware,
        manufacturer_distribution=[
            NamedCountResponse(name=item.name, count=item.count) for item in data.manufacturer_breakdown
        ],
        platform_distribution=[
            NamedCountResponse(name=item.name, count=item.count) for item in data.platform_breakdown
        ],
        collection_value=data.collection_value,
        recently_added=[_recently_added_from_item(item) for item in data.recently_added],
    )
