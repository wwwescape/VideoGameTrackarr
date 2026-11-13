from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin


class GogLibraryEntry(TimestampMixin, Base):
    """One row per GOG product id the user owns, cached from embed.gog.com's
    getFilteredProducts. Doubles as the GOG product id -> IGDB game match cache
    (game_id null = not yet matched, or confirmed no IGDB external_games mapping
    exists) and the review-queue bookkeeping for a matched game not yet added to
    the library (see app/services/gog_service.py). Mirrors SteamLibraryEntry,
    minus playtime: GOG exposes no playtime for owned games, so sync is an
    owned-copy sync only."""

    __tablename__ = "gog_library_entries"

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
    """One queued/completed NAS download of a single GOG installer file. The file
    lands in the uploads volume under gog-installers/<product id>/<filename> and
    is served back to the user's device through the authenticated file route —
    never through the public /uploads mount (see main.py's UploadsStaticFiles).
    Status is the durable queue the gog_download drainer job works through."""

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
    total_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    downloaded_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=GogDownloadStatus.QUEUED)
    error: Mapped[str | None] = mapped_column(String(512))

    game: Mapped["Game"] = relationship()  # noqa: F821
