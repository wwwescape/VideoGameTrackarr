from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin


class SteamLibraryEntry(TimestampMixin, Base):
    """One row per Steam AppID the user owns, cached from GetOwnedGames. Doubles as the
    Steam AppID -> IGDB game match cache (game_id null = not yet matched, or confirmed no
    IGDB external_games mapping exists) and the review-queue bookkeeping for a matched game
    not yet added to the library (see app/services/steam_service.py)."""

    __tablename__ = "steam_library_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    steam_app_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    steam_name: Mapped[str] = mapped_column(String(255), nullable=False)
    steam_playtime_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    steam_last_played_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    game_id: Mapped[int | None] = mapped_column(ForeignKey("games.id"), index=True)
    dismissed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    game: Mapped["Game | None"] = relationship()  # noqa: F821


class SteamWishlistEntry(TimestampMixin, Base):
    """One row per Steam AppID on the user's Steam Wishlist, cached from
    IWishlistService/GetWishlist. Same Steam AppID -> IGDB game match cache and
    review-queue bookkeeping role as SteamLibraryEntry above, but for wishlisted rather than
    owned apps — no playtime/last-played fields, since GetWishlist doesn't return them (it
    only ever gives appid/priority/date_added, confirmed live against the real API; see
    app/services/steam_client.py)."""

    __tablename__ = "steam_wishlist_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    steam_app_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    # Never null, but not always a real title — GetWishlist gives no name at all, so an
    # unmatched entry gets a "Steam App {id}" placeholder (same fallback get_owned_games uses)
    # until either an IGDB match resolves a real game name or the user clicks "Add as custom
    # game" (which fetches the real name on demand via SteamStoreClient).
    steam_name: Mapped[str] = mapped_column(String(255), nullable=False)
    wishlist_added_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    game_id: Mapped[int | None] = mapped_column(ForeignKey("games.id"), index=True)
    dismissed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    game: Mapped["Game | None"] = relationship()  # noqa: F821
