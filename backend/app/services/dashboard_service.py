from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Literal

from sqlalchemy.orm import Session

from app.repositories import dashboard_repository
from app.repositories.accessory_repository import AccessoryWithStatus
from app.repositories.dashboard_repository import DashboardStatsData
from app.repositories.device_repository import DeviceWithStatus
from app.repositories.game_repository import GameWithStatus

Kind = Literal["game", "device", "accessory"]


def get_stats(db: Session) -> DashboardStatsData:
    return dashboard_repository.get_stats(db)


@dataclass
class UpcomingReleaseItem:
    kind: Kind
    game: GameWithStatus | None
    device: DeviceWithStatus | None
    accessory: AccessoryWithStatus | None
    release_date: date


def _release_calendar_name(item: UpcomingReleaseItem) -> str:
    if item.kind == "game":
        assert item.game is not None
        return item.game.game.name
    if item.kind == "device":
        assert item.device is not None
        return item.device.device.official_name
    assert item.accessory is not None
    return item.accessory.accessory.official_name


def list_upcoming_releases(db: Session) -> list[UpcomingReleaseItem]:
    now = datetime.now(UTC)
    games = dashboard_repository.list_upcoming_releases(db, now)
    hardware = dashboard_repository.list_upcoming_hardware_releases(db, now.date())

    items = [
        UpcomingReleaseItem(
            kind="game",
            game=game,
            device=None,
            accessory=None,
            release_date=datetime.fromtimestamp(game.game.first_release_date, tz=UTC).date(),
        )
        for game in games
    ]
    items.extend(
        UpcomingReleaseItem(
            kind=release.kind,
            game=None,
            device=release.device,
            accessory=release.accessory,
            release_date=release.release_date,
        )
        for release in hardware
    )

    items.sort(key=lambda item: (item.release_date, _release_calendar_name(item)))
    return items
