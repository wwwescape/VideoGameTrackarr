"""IGDB gaming-industry Events (E3/Gamescom/etc.) — a plain, IGDB-sourced read-only feed,
distinct from every entity in catalog.py. Kept in its own file since Events aren't part of
the Game object graph at all, same reasoning as hardware.py/itad.py being their own files."""

from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin


class Event(TimestampMixin, Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Unlike Game.igdb_id (nullable — games can be manually added), every Event row is
    # IGDB-sourced; there's no manual-add path for events.
    igdb_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    # The public lookup key for /api/events/{slug}. No uuid column needed (unlike Game) —
    # events have no manual-add path that would need a synthetic identifier.
    slug: Mapped[str | None] = mapped_column(String(512), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    start_time: Mapped[int | None] = mapped_column(BigInteger, comment="unix timestamp, from IGDB")
    end_time: Mapped[int | None] = mapped_column(BigInteger, comment="unix timestamp, from IGDB")
    time_zone: Mapped[str | None] = mapped_column(String(100), comment="IGDB's free-text timezone label")
    live_stream_url: Mapped[str | None] = mapped_column(String(1024))
    # Resolved/normalized at sync time, same "fetch from IGDB once, persist, serve from DB"
    # treatment as Game.cover_url — event logos are landscape banners (confirmed live against
    # the real API), not portrait covers.
    event_logo_url: Mapped[str | None] = mapped_column(String(1024))
    # IGDB's own created_at/updated_at on the event record — kept distinct from
    # TimestampMixin's created_at/updated_at (this app's local row bookkeeping) to avoid a
    # name collision and a semantic mixup, same reasoning as Game.first_release_date staying
    # its own column.
    igdb_created_at: Mapped[int | None] = mapped_column(BigInteger)
    igdb_updated_at: Mapped[int | None] = mapped_column(BigInteger)
    checksum: Mapped[str | None] = mapped_column(
        String(64), comment="IGDB's own change-detection hash — stored for future use, not read yet"
    )

    videos: Mapped[list["EventVideo"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    networks: Mapped[list["EventNetwork"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    event_games: Mapped[list["EventGame"]] = relationship(back_populates="event", cascade="all, delete-orphan")


class EventVideo(Base):
    """Exact mirror of catalog.py's GameVideo — same shape on purpose so the frontend's
    existing VideoGallery/VideoDialog ({id, videoId, name}) works unmodified for events."""

    __tablename__ = "event_videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True, nullable=False)
    igdb_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    name: Mapped[str | None] = mapped_column(String(255))
    video_id: Mapped[str] = mapped_column(String(255), nullable=False, comment="YouTube video id")

    event: Mapped["Event"] = relationship(back_populates="videos")


class EventNetwork(Base):
    __tablename__ = "event_networks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True, nullable=False)
    igdb_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    # Resolved to a plain string at sync time (e.g. "Twitter"/"YouTube") via IGDB's
    # event_networks.network_type.name dot-path — confirmed live that network_type is its own
    # reference entity, same "resolve once, store a plain string" treatment Game.category
    # gets rather than a second lookup table.
    network_type: Mapped[str | None] = mapped_column(String(100))
    url: Mapped[str] = mapped_column(String(1024), nullable=False)

    event: Mapped["Event"] = relationship(back_populates="networks")


class EventGame(Base):
    """One row per game IGDB lists under an event's `games` array. Always stores the raw IGDB
    game id, whether or not it resolves locally — game_id is populated (via
    game_repository.get_game_by_igdb_id) only when that IGDB game happens to already be
    imported into this instance's catalog, making the tile clickable; otherwise it stays
    NULL and the frontend renders a plain, non-interactive tile. This is a per-row lookup,
    not a bulk cross-reference "insight" — deliberately out of scope for this feature."""

    __tablename__ = "event_games"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True, nullable=False)
    igdb_game_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    game_id: Mapped[int | None] = mapped_column(ForeignKey("games.id"), index=True)
    # Denormalized display fields, cached from IGDB at sync time — same "fetch once, persist"
    # treatment as everywhere else, so rendering the games grid never needs a live IGDB fetch
    # for games that aren't locally known.
    name: Mapped[str | None] = mapped_column(String(512))
    cover_url: Mapped[str | None] = mapped_column(String(1024))

    event: Mapped["Event"] = relationship(back_populates="event_games")
    # Read-only, one-directional — same style as ReleaseDate.platform. No back_populates on
    # Game: an event referencing a game isn't part of Game's own object graph.
    game: Mapped["Game | None"] = relationship()  # noqa: F821
