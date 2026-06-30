from sqlalchemy.orm import Session

from app.repositories import hardware_stats_repository
from app.repositories.hardware_stats_repository import HardwareStatsData


def get_stats(db: Session) -> HardwareStatsData:
    return hardware_stats_repository.get_stats(db)
