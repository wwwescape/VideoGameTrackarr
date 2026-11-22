from sqlalchemy import BigInteger, Boolean, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin


class GogLibraryEntry(TimestampMixin, Base):
    """One row per GOG product the connected account owns, cached from embed.gog.com's
    getFilteredProducts. Same role as SteamLibraryEntry: the GOG product id -> IGDB game
    match cache (game_id null = not matched yet, or IGDB has no external_games mapping) and
    the bookkeeping for the GOG Sync page. No playtime columns: GOG exposes none for owned
    games, so GOG Sync only ever adds owned copies (see app/services/gog_service.py)."""

    __tablename__ = "gog_library_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    gog_product_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    gog_name: Mapped[str] = mapped_column(String(255), nullable=False)
    game_id: Mapped[int | None] = mapped_column(ForeignKey("games.id"), index=True)
    dismissed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    game: Mapped["Game | None"] = relationship()  # noqa: F821


class GogWishlistEntry(TimestampMixin, Base):
    """One row per GOG product on the connected account's GOG wishlist. Same role as
    SteamWishlistEntry. GOG's wishlist only gives product ids, so gog_name comes from GOG's
    public product lookup during Import ("GOG product {id}" if that fails)."""

    __tablename__ = "gog_wishlist_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    gog_product_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    gog_name: Mapped[str] = mapped_column(String(255), nullable=False)
    game_id: Mapped[int | None] = mapped_column(ForeignKey("games.id"), index=True)
    dismissed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    game: Mapped["Game | None"] = relationship()  # noqa: F821


class GogDownloadStatus:
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    COMPLETED = "completed"
    FAILED = "failed"


class GogDownload(TimestampMixin, Base):
    """One offline-installer file downloaded (or queued for download) to the server, under
    uploads/gog-installers/<product id>/<filename>. Status doubles as the durable queue the
    download job works through. Sizes are BigInteger: one installer part can exceed 2 GB."""

    __tablename__ = "gog_downloads"
    __table_args__ = (
        UniqueConstraint("gog_product_id", "file_id", name="uq_gog_downloads_product_file"),
        Index("ix_gog_downloads_game_id", "game_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), nullable=False)
    gog_product_id: Mapped[int] = mapped_column(Integer, nullable=False)
    installer_id: Mapped[str] = mapped_column(String(64), nullable=False)
    file_id: Mapped[str] = mapped_column(String(64), nullable=False)
    filename: Mapped[str | None] = mapped_column(String(255))
    total_size: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0, server_default="0")
    downloaded_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0, server_default="0")
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=GogDownloadStatus.QUEUED, server_default=GogDownloadStatus.QUEUED
    )
    error: Mapped[str | None] = mapped_column(String(512))

    game: Mapped["Game"] = relationship()  # noqa: F821
