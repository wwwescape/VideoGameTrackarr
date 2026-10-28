import enum
from datetime import datetime

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UTCDateTime, enum_column


class ConnectorKind(enum.Enum):
    # Anything that can send a list of games over HTTP: a script, a phone shortcut, a launcher.
    CUSTOM = "custom"
    # A Nintendo Switch homebrew (NX Remote Launcher) sending installed title IDs, which the
    # Nintendo title database turns into names and player counts.
    NX_REMOTE_LAUNCHER = "nx_remote_launcher"


class ConnectorAbsentMode(enum.Enum):
    # A game a full sync no longer lists stays in the library as it is; the connector page
    # lists it as no longer reported.
    KEEP = "keep"
    # Its copy gets a note saying the device no longer reports it.
    NOTE = "note"
    # Its copy is removed (the game stays if it has other copies, notes or progress).
    REMOVE = "remove"


class Connector(TimestampMixin, Base):
    """A named endpoint other software syncs games into (see app/api/routes/connect.py).
    Each copy it adds uses the connector's defaults: platform, format, storefront, owned or
    wishlisted. Several can exist side by side, one per device or script."""

    __tablename__ = "connectors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # The {slug} in /api/connect/{slug}/...: what a device is told to talk to.
    slug: Mapped[str] = mapped_column(String(60), unique=True, nullable=False, index=True)
    kind: Mapped[ConnectorKind] = mapped_column(enum_column(ConnectorKind), nullable=False)
    platform_id: Mapped[int | None] = mapped_column(ForeignKey("platforms.id"))
    media_format: Mapped[str | None] = mapped_column(String(8))
    digital_storefront: Mapped[str | None] = mapped_column(String(100))
    wishlist: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    absent_mode: Mapped[ConnectorAbsentMode] = mapped_column(
        enum_column(ConnectorAbsentMode), nullable=False, default=ConnectorAbsentMode.KEEP
    )
    last_sync_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    last_sync_result: Mapped[dict | None] = mapped_column(JSON)

    devices: Mapped[list["ConnectorDevice"]] = relationship(
        back_populates="connector", cascade="all, delete-orphan", order_by="ConnectorDevice.id"
    )


class ConnectorDevice(TimestampMixin, Base):
    """A device allowed to sync into a connector, after its pairing code was approved in the
    app. Only a hash of its token is kept, so a stolen database can't sync on its behalf."""

    __tablename__ = "connector_devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    connector_id: Mapped[int] = mapped_column(
        ForeignKey("connectors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

    connector: Mapped[Connector] = relationship(back_populates="devices")


class ConnectorPairing(TimestampMixin, Base):
    """A pairing in progress: the device shows `code` and polls with `poll_token` until
    someone signed in to the app approves the code, which creates its ConnectorDevice."""

    __tablename__ = "connector_pairings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    connector_id: Mapped[int] = mapped_column(
        ForeignKey("connectors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(9), unique=True, nullable=False)
    poll_token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    device_name: Mapped[str] = mapped_column(String(100), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False)
    # Set on approval; handed to the device once on its next poll, then cleared.
    device_token: Mapped[str | None] = mapped_column(String(64))
    approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")


class ConnectorGame(TimestampMixin, Base):
    """One game a connector has reported, by its own id for it (a Switch title ID, a
    launcher's game id...), with the game and copy it became, so the next sync updates
    rather than duplicates, and a game it stops reporting can be told apart."""

    __tablename__ = "connector_games"
    __table_args__ = (UniqueConstraint("connector_id", "external_id", name="uq_connector_games_external_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    connector_id: Mapped[int] = mapped_column(
        ForeignKey("connectors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    external_id: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    game_id: Mapped[int | None] = mapped_column(ForeignKey("games.id", ondelete="SET NULL"), index=True)
    library_item_id: Mapped[int | None] = mapped_column(ForeignKey("library_items.id", ondelete="SET NULL"))
    present: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
