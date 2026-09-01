from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin


class ItadPriceCache(TimestampMixin, Base):
    """One row per game — price is a property of the title, not of any one wishlist row
    tracking it (unlike target_price on LibraryItem, which is per-row). Unique on game_id,
    unlike SteamLibraryEntry's game_id: there's exactly one IsThereAnyDeal match per game,
    never multiple candidate rows."""

    __tablename__ = "itad_price_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), unique=True, nullable=False)
    itad_game_id: Mapped[str | None] = mapped_column(
        String(64), comment="ITAD's internal game id; null = no match found"
    )
    ignored: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="Set once a title search comes back with no exact match — stops permanent "
        "re-search churn on every job run until Retry clears it",
    )
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
