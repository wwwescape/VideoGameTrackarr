from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin


class PlatPricesCache(TimestampMixin, Base):
    """One row per game — same shape/reasoning as ItadPriceCache. current_shop_name and
    historical_low_shop_name are always the literal "PlayStation Store" (PlatPrices has no
    shop diversity to report — it is the PS Store), and historical_low_at is always null
    (PlatPrices' free tier exposes LowestEverPrice but not when it was hit)."""

    __tablename__ = "platprices_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), unique=True, nullable=False)
    ppid: Mapped[str | None] = mapped_column(String(64), comment="PlatPrices' internal id; null = no match found")
    current_price_amount: Mapped[float | None] = mapped_column()
    current_price_currency: Mapped[str | None] = mapped_column(String(8))
    current_shop_name: Mapped[str | None] = mapped_column(String(100))
    current_cut: Mapped[int | None] = mapped_column(Integer, comment="Current discount percentage")
    historical_low_amount: Mapped[float | None] = mapped_column()
    historical_low_currency: Mapped[str | None] = mapped_column(String(8))
    historical_low_shop_name: Mapped[str | None] = mapped_column(String(100))
    historical_low_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    game: Mapped["Game"] = relationship()  # noqa: F821
