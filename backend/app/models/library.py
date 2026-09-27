import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
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
    target_price: Mapped[float | None] = mapped_column(
        comment="Only meaningful when status=wishlist — flags this row on sale once the price drops to or below this"
    )
    track_for_sales: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="Opt-in: only rows with this set are ever matched against ITAD/PlatPrices",
    )
    acquired_at: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    steelbook: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="Only meaningful when format=physical — a Steelbook/metal-case copy vs. a standard case",
    )

    game: Mapped["Game"] = relationship()  # noqa: F821
    platform: Mapped["Platform | None"] = relationship()  # noqa: F821
    region: Mapped["Region | None"] = relationship()  # noqa: F821
    # A copy can hold several ROMs (e.g. regional revisions), oldest first. The ORM cascade
    # only covers the rows — files on disk are removed by rom_service, which every delete path
    # (single copy, whole game, format/status change, restore) goes through.
    roms: Mapped[list["RomFile"]] = relationship(
        back_populates="library_item", cascade="all, delete-orphan", order_by="RomFile.id"
    )


class RomFile(TimestampMixin, Base):
    """A user-uploaded ROM/disc image/abandonware archive attached to one owned platform
    copy, playable in-browser via EmulatorJS when its platform + file type map to a bundled
    core. Deliberately stores no core: playability is resolved at read time from
    emulation_cores.py, so adding a core later lights up files uploaded before it existed."""

    __tablename__ = "rom_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    library_item_id: Mapped[int] = mapped_column(ForeignKey("library_items.id"), index=True, nullable=False)
    # Optional, user-given — tells several ROMs on one copy apart (e.g. "USA Rev 1").
    label: Mapped[str | None] = mapped_column(String(100))
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="uuid-based name on disk — never derived from user input"
    )
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    extension: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        comment="The playable file's extension — the upload's own, or the detected inner file's for a zip",
    )
    is_archive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    # The game's own battery/SRAM save ("in-game save"), synced from the player — at most one
    # per ROM, replaced on every sync. Paths are relative to rom_service.get_rom_dir().
    sram_stored_filename: Mapped[str | None] = mapped_column(String(64))
    sram_size_bytes: Mapped[int | None] = mapped_column(Integer)
    sram_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    library_item: Mapped["LibraryItem"] = relationship(back_populates="roms")
    save_states: Mapped[list["RomSaveState"]] = relationship(
        back_populates="rom_file",
        cascade="all, delete-orphan",
        order_by="RomSaveState.id.desc()",
    )


class BiosFile(TimestampMixin, Base):
    """A console BIOS the user dumped themselves and uploaded (Settings → Emulation), needed by
    some emulator cores (see emulation_cores.BIOS_SYSTEMS). One file per accepted filename per
    system; stored privately next to the ROMs and only ever served to the player through a
    short-lived signed URL."""

    __tablename__ = "bios_files"
    __table_args__ = (UniqueConstraint("system", "filename"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    system: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(100), nullable=False, comment="The exact name the core expects")
    stored_filename: Mapped[str] = mapped_column(String(64), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    md5: Mapped[str] = mapped_column(String(32), nullable=False)


class RomSaveState(TimestampMixin, Base):
    """One EmulatorJS save state (a full emulator snapshot) for a ROM, taken with the player's
    Save State button. Unlimited per ROM — the user deletes them by hand. Only meaningful
    for the exact ROM file it was taken on, so replacing the ROM deletes them (rom_service)."""

    __tablename__ = "rom_save_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rom_file_id: Mapped[int] = mapped_column(ForeignKey("rom_files.id"), index=True, nullable=False)
    stored_filename: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="Relative to the ROM dir, uuid-based — never derived from user input"
    )
    screenshot_filename: Mapped[str | None] = mapped_column(String(64))
    screenshot_media_type: Mapped[str | None] = mapped_column(String(32))
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    rom_file: Mapped["RomFile"] = relationship(back_populates="save_states")


class GameProgress(TimestampMixin, Base):
    """One row per (game, platform) — a game owned on multiple platforms tracks progress
    separately for each, since playtime/status on one copy says nothing about another."""

    __tablename__ = "game_progress"
    __table_args__ = (UniqueConstraint("game_id", "platform_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True, nullable=False)
    platform_id: Mapped[int] = mapped_column(ForeignKey("platforms.id"), nullable=False)

    play_status: Mapped[PlayStatus] = mapped_column(enum_column(PlayStatus), nullable=False, default=PlayStatus.NONE)
    playtime_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rating: Mapped[float | None] = mapped_column()
    review: Mapped[str | None] = mapped_column(Text)

    started_at: Mapped[date | None] = mapped_column(Date)
    completed_at: Mapped[date | None] = mapped_column(Date)
    last_played_at: Mapped[date | None] = mapped_column(Date)

    game: Mapped["Game"] = relationship()  # noqa: F821
    platform: Mapped["Platform"] = relationship()  # noqa: F821


class PlaySession(Base):
    __tablename__ = "play_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True, nullable=False)
    platform_id: Mapped[int] = mapped_column(ForeignKey("platforms.id"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)

    game: Mapped["Game"] = relationship()  # noqa: F821
    platform: Mapped["Platform"] = relationship()  # noqa: F821


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
    text_color: Mapped[str | None] = mapped_column(String(20), comment="hex text color for UI chips")


class GameTag(Base):
    __tablename__ = "game_tags"

    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id"), primary_key=True)

    game: Mapped["Game"] = relationship()  # noqa: F821
    tag: Mapped["Tag"] = relationship()
