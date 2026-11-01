import uuid

from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.library import LibraryStatus, Tag
from app.models.mixins import TimestampMixin, enum_column


class ToysToLifeItem(TimestampMixin, Base):
    """One real-world Toys-to-Life product (e.g. a LEGO Dimensions Fun Pack), seeded from
    docs/data/toys_to_life/*.csv. The catalog columns are reference data that a re-import
    overwrites; `user_rating` is the user's own and is never touched by an import — same
    split as games.user_rating on the otherwise IGDB-synced games table. `line` is the
    product line's slug (see app/services/toys_to_life_lines.py), and `set_number` is unique
    within it, so the pair is the stable key imports, backups and URLs go by."""

    __tablename__ = "toys_to_life_items"
    __table_args__ = (UniqueConstraint("line", "set_number", name="uq_toys_to_life_items_line_set_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, default=lambda: str(uuid.uuid4()))

    line: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    set_number: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    pack_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    franchise: Mapped[str | None] = mapped_column(String(255))
    minifigures: Mapped[str | None] = mapped_column(String(255))

    # Only starter kits are platform-specific; every other pack works on all platforms.
    platform_name: Mapped[str | None] = mapped_column(String(100))
    platform_igdb_id: Mapped[int | None] = mapped_column(BigInteger, index=True)

    # ISO dates ("2015-09-27"), or just a year when that's all the source knows.
    release_date_na: Mapped[str | None] = mapped_column(String(10))
    release_date_eu: Mapped[str | None] = mapped_column(String(10))
    release_date_ww: Mapped[str | None] = mapped_column(String(10))

    # Not unique: every starter kit shares its base game's IGDB entry.
    igdb_id: Mapped[int | None] = mapped_column(BigInteger, index=True)
    igdb_url: Mapped[str | None] = mapped_column(String(1024))
    summary: Mapped[str | None] = mapped_column(Text)

    # Your rating, 1-10 stars (null = not rated).
    user_rating: Mapped[int | None] = mapped_column(Integer)

    copies: Mapped[list["ToysToLifeCopy"]] = relationship(
        back_populates="item", cascade="all, delete-orphan", order_by="ToysToLifeCopy.id"
    )

    # Like a game: owned with any owned copy, wishlisted with any wishlisted one (both at once
    # when you own one copy and want another).
    @property
    def owned(self) -> bool:
        return any(copy.status == LibraryStatus.OWNED for copy in self.copies)

    @property
    def wishlisted(self) -> bool:
        return any(copy.status == LibraryStatus.WISHLIST for copy in self.copies)

    @property
    def status(self) -> LibraryStatus | None:
        """One status for the pack: owned when you own any copy, else wishlisted, else neither."""
        statuses = {copy.status for copy in self.copies}
        if LibraryStatus.OWNED in statuses:
            return LibraryStatus.OWNED
        return LibraryStatus.WISHLIST if statuses else None


class ToysToLifeCopy(TimestampMixin, Base):
    """One copy of a pack you own or want, like a game's library copies: several are fine
    (a sealed one and an opened one, or one owned and another wishlisted)."""

    __tablename__ = "toys_to_life_copies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("toys_to_life_items.id"), nullable=False, index=True)
    status: Mapped[LibraryStatus] = mapped_column(enum_column(LibraryStatus), nullable=False, index=True)
    # What you paid (owned) or would pay (wishlisted), in your display currency.
    price: Mapped[float | None] = mapped_column()
    notes: Mapped[str | None] = mapped_column(Text)

    item: Mapped["ToysToLifeItem"] = relationship(back_populates="copies")


class ToysToLifeTag(Base):
    __tablename__ = "toys_to_life_tags"

    item_id: Mapped[int] = mapped_column(ForeignKey("toys_to_life_items.id"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id"), primary_key=True)

    item: Mapped["ToysToLifeItem"] = relationship()
    tag: Mapped["Tag"] = relationship()


class ToysToLifeNote(TimestampMixin, Base):
    __tablename__ = "toys_to_life_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("toys_to_life_items.id"), index=True, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    item: Mapped["ToysToLifeItem"] = relationship()
