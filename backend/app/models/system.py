from datetime import datetime

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UTCDateTime


class User(TimestampMixin, Base):
    """Single admin account gatekeeping this instance — not a multi-tenant user model.
    Library/catalog tables are intentionally not scoped by user_id; see roadmap decision."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    public_share_token: Mapped[str | None] = mapped_column(
        String(64), unique=True, comment="Unlisted share-link token for the public Games/Hardware view"
    )
    steam_id_64: Mapped[str | None] = mapped_column(
        String(32), comment="Steam profile SteamID64, used for Steam Web API sync"
    )
    currency: Mapped[str | None] = mapped_column(
        String(3), comment="Display currency (ISO 4217 code), shared by every browser"
    )
    overview_layout: Mapped[list[dict] | None] = mapped_column(
        JSON, comment="Overview page sections in display order, each {key, hidden}; null = the default layout"
    )
    screensaver_interval_seconds: Mapped[int | None] = mapped_column(
        Integer, comment="Screensaver lab: seconds each cover is shown, 5-15; null = the default (8)"
    )
    # Screensaver lab, Settings → Screensaver → What to show. At least one of owned/wishlist is
    # always on (auth_service.set_preferences); custom is separate (where a game's details came
    # from, not whether you have it).
    screensaver_show_owned: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true", comment="Screensaver shows games you own"
    )
    screensaver_show_wishlist: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false", comment="Screensaver shows wishlisted games"
    )
    screensaver_include_custom: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        comment="Screensaver includes custom games (added by hand, no IGDB id)",
    )
    last_seen_version: Mapped[str | None] = mapped_column(
        String(32),
        comment="Newest app version whose What's New was closed; null = an install from before What's New",
    )
    game_filter_fields: Mapped[list[dict] | None] = mapped_column(
        JSON, comment="Game list Filter dialog fields, each {key, hidden}; null = every field shown"
    )
    saved_game_filters: Mapped[list[dict] | None] = mapped_column(
        JSON, comment="Named game list filters, each {name, filters}; filters is the frontend's own state"
    )


class RefreshToken(Base):
    """Server-side record of issued refresh tokens, so they can be revoked before their
    natural expiry (logout, password change) — access tokens are short-lived and stateless
    and never get a table; only refresh tokens are dangerous enough for long to need this."""

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    jti: Mapped[str] = mapped_column(String(36), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    replaced_by_jti: Mapped[str | None] = mapped_column(
        String(36), comment="jti of the token this one was rotated into"
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship()
