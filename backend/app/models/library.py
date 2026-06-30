import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, enum_column


class LibraryStatus(enum.Enum):
    OWNED = "owned"
    WISHLIST = "wishlist"


class MediaFormat(enum.Enum):
    PHYSICAL = "physical"
    DIGITAL = "digital"
    ISO = "iso"
    ROM = "rom"
    ABANDONWARE = "abandonware"
    OTHER = "other"


class RatingBoard(enum.Enum):
    ESRB = "esrb"
    PEGI = "pegi"
    CERO = "cero"
    USK = "usk"
    GRAC = "grac"
    CLASSIND = "classind"
    ACB = "acb"
    IARC = "iarc"


class PlayStatus(enum.Enum):
    NONE = "none"
    BACKLOG = "backlog"
    PLAYING = "playing"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class LibraryItem(TimestampMixin, Base):
    """One row per copy the user owns or wants — mirrors the old `game_status` table but
    splits "which copy do I have" from "how far am I through this game" (see GameProgress).
    """

    __tablename__ = "library_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True, nullable=False)
    platform_id: Mapped[int | None] = mapped_column(ForeignKey("platforms.id"))
    region_id: Mapped[int | None] = mapped_column(ForeignKey("regions.id"))

    status: Mapped[LibraryStatus] = mapped_column(enum_column(LibraryStatus), nullable=False, index=True)
    format: Mapped[MediaFormat | None] = mapped_column(enum_column(MediaFormat))
    digital_storefront: Mapped[str | None] = mapped_column(
        String(100), comment="e.g. Steam, PSN, Epic Games — only meaningful when format=digital"
    )
    rating_board: Mapped[RatingBoard | None] = mapped_column(enum_column(RatingBoard))
    edition: Mapped[str | None] = mapped_column(
        String(255), comment="Free text for now; revisit as a structured table if IGDB editions data improves"
    )
    price: Mapped[float | None] = mapped_column()
    acquired_at: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)

    game: Mapped["Game"] = relationship()  # noqa: F821
    platform: Mapped["Platform | None"] = relationship()  # noqa: F821
    region: Mapped["Region | None"] = relationship()  # noqa: F821


class GameProgress(TimestampMixin, Base):
    """One row per game: play status, playtime, personal rating/review."""

    __tablename__ = "game_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), unique=True, index=True, nullable=False)

    play_status: Mapped[PlayStatus] = mapped_column(
        enum_column(PlayStatus), nullable=False, default=PlayStatus.NONE
    )
    playtime_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rating: Mapped[float | None] = mapped_column()
    review: Mapped[str | None] = mapped_column(Text)

    started_at: Mapped[date | None] = mapped_column(Date)
    completed_at: Mapped[date | None] = mapped_column(Date)
    last_played_at: Mapped[date | None] = mapped_column(Date)

    game: Mapped["Game"] = relationship()  # noqa: F821


class PlaySession(Base):
    __tablename__ = "play_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)

    game: Mapped["Game"] = relationship()  # noqa: F821


class Note(TimestampMixin, Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    game: Mapped["Game"] = relationship()  # noqa: F821


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    color: Mapped[str | None] = mapped_column(String(20), comment="hex color for UI chips")


class GameTag(Base):
    __tablename__ = "game_tags"

    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id"), primary_key=True)

    game: Mapped["Game"] = relationship()  # noqa: F821
    tag: Mapped["Tag"] = relationship()


