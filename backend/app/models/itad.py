from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin


class ItadPriceCache(TimestampMixin, Base):
    """One row per game — price is a property of the title, not of any one wishlist row
    tracking it (unlike target_price on LibraryItem, which is per-row). Unique on game_id,
    unlike SteamLibraryEntry's game_id: there's exactly one IsThereAnyDeal match per game,
    never multiple candidate rows.

    A game can have deals live at several shops at once (Steam, GOG, Epic...) at different
    prices, but a wishlist row is only ever buyable through the one storefront its own
    digital_storefront names — `deals` keeps every shop ITAD reported as of the last refresh
    so app/services/storefront_matching.py can pick the one that actually matches a given
    row, instead of every row showing whichever shop happened to be globally cheapest."""

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
    deals: Mapped[list[dict] | None] = mapped_column(
        JSON,
        comment="Every shop ITAD reported a current deal for as of the last refresh — each "
        "dict has shop_name/price_amount/price_currency/cut. current_* above stays the "
        "cheapest of these (used as a coarse 'is anything on sale anywhere' filter); this is "
        "what lets a specific wishlist row match its own tracked storefront.",
    )
    historical_low_amount: Mapped[float | None] = mapped_column()
    historical_low_currency: Mapped[str | None] = mapped_column(String(8))
    historical_low_shop_name: Mapped[str | None] = mapped_column(String(100))
    historical_low_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    game: Mapped["Game"] = relationship()  # noqa: F821
