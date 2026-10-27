from datetime import datetime

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.catalog import GameCategory
from app.models.mixins import TimestampMixin, UTCDateTime, enum_column


class IgdbImportEntry(TimestampMixin, Base):
    """IGDB Import's cached name match for one custom game (no igdb_id): what the Find matches
    job (igdb_import_jobs.py) found on IGDB, plus the page's own bookkeeping (ignored, queued
    for the bulk Link job). Removed once the game is linked, merged or deleted."""

    __tablename__ = "igdb_import_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), unique=True, nullable=False, index=True)

    # The one IGDB game whose name matches exactly (see igdb_import_service.normalize_name),
    # or null with exact_match_count 0 (no match) or > 1 (several, for the user to pick).
    match_igdb_id: Mapped[int | None] = mapped_column(BigInteger)
    match_name: Mapped[str | None] = mapped_column(String(512))
    match_cover_url: Mapped[str | None] = mapped_column(String(1024))
    match_first_release_date: Mapped[int | None] = mapped_column(BigInteger)
    match_category: Mapped[GameCategory | None] = mapped_column(enum_column(GameCategory))
    # An addon match's IGDB parent: linking imports it first when it isn't in the library.
    match_parent_igdb_id: Mapped[int | None] = mapped_column(BigInteger)
    exact_match_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    checked_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

    dismissed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    # Picked for the bulk Link job, which works through these and clears it.
    queued: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    game: Mapped["Game"] = relationship()  # noqa: F821
