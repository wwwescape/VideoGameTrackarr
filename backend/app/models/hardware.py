import enum
import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.library import LibraryStatus, RatingBoard, Tag
from app.models.mixins import TimestampMixin, enum_column


class HardwareCondition(enum.Enum):
    SEALED = "sealed"
    NEW = "new"
    LIKE_NEW = "like_new"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


class Manufacturer(TimestampMixin, Base):
    __tablename__ = "manufacturers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)


class HardwarePlatform(TimestampMixin, Base):
    """A hardware-scoped platform vocabulary (e.g. "PlayStation 5", "Xbox Series") — kept
    separate from the IGDB-sourced `platforms` table (catalog.Platform), which is synced
    from IGDB's per-game platform list and not meant to double as hardware's own taxonomy.
    Shared by both Device and Accessory (AccessoryCompatibility) — stays "Hardware"-named
    as the umbrella vocabulary, distinct from the Device-specific rename elsewhere in this
    module."""

    __tablename__ = "hardware_platforms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)


class DeviceType(TimestampMixin, Base):
    __tablename__ = "device_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)


class AccessoryType(TimestampMixin, Base):
    __tablename__ = "accessory_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)


class StorageVariant(TimestampMixin, Base):
    __tablename__ = "storage_variants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)


class Color(TimestampMixin, Base):
    __tablename__ = "colors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)


class HardwareReferenceEntry(TimestampMixin, Base):
    """Curated reference data imported from data/hardware/*.xlsx (one row per real-world
    hardware SKU across Nintendo/Sony/Xbox) — powers the Brand/Console/Variant cascades on
    the Add Device/Add Accessory (Predefined) forms and the "rich" descriptive data shown on
    detail pages. Distinct from Device/Accessory, which are the user's own catalog of
    ownable SKUs; entries here are descriptive lookup data sourced from the import, not
    something a user owns directly. `release_date` stays a free-text column (rather than a
    real `Date`) but the import always normalizes it down to just a 4-digit year — the source
    spreadsheets mix Excel date cells and bare-year text, and the app only ever needs the
    year."""

    __tablename__ = "hardware_reference_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    brand: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    family: Mapped[str | None] = mapped_column(String(100))
    generation: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    generation_short: Mapped[str | None] = mapped_column(String(50))
    artefact: Mapped[str] = mapped_column(String(255), nullable=False)
    official_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    release_date: Mapped[str | None] = mapped_column(String(20))
    discontinued: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    compatibility: Mapped[str | None] = mapped_column(String(255))
    summary: Mapped[str | None] = mapped_column(Text)


class Device(TimestampMixin, Base):
    """A master catalog row for one physical device SKU (e.g. "Xbox Series X") — not an
    owned copy; see UserDevice for that. `external_source`/`external_id` are the sync
    hook for future automated catalog sources (the seed script uses external_source="seed"
    so re-running it upserts instead of duplicating)."""

    __tablename__ = "devices"
    __table_args__ = (UniqueConstraint("external_source", "external_id", name="uq_hardware_external_ref"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, default=lambda: str(uuid.uuid4()))

    manufacturer_id: Mapped[int] = mapped_column(ForeignKey("manufacturers.id"), nullable=False, index=True)
    hardware_platform_id: Mapped[int | None] = mapped_column(ForeignKey("hardware_platforms.id"), index=True)
    device_type_id: Mapped[int] = mapped_column(ForeignKey("device_types.id"), nullable=False, index=True)

    official_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    model: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[str | None] = mapped_column(String(100))

    storage_variant_id: Mapped[int | None] = mapped_column(ForeignKey("storage_variants.id"))
    color_id: Mapped[int | None] = mapped_column(ForeignKey("colors.id"))
    rating_board: Mapped[RatingBoard | None] = mapped_column(enum_column(RatingBoard))
    hardware_reference_entry_id: Mapped[int | None] = mapped_column(ForeignKey("hardware_reference_entries.id"))

    external_source: Mapped[str | None] = mapped_column(String(100), index=True)
    external_id: Mapped[str | None] = mapped_column(String(100), index=True)

    manufacturer: Mapped["Manufacturer"] = relationship()
    hardware_platform: Mapped["HardwarePlatform | None"] = relationship()
    device_type: Mapped["DeviceType"] = relationship()
    storage_variant: Mapped["StorageVariant | None"] = relationship()
    color: Mapped["Color | None"] = relationship()
    hardware_reference_entry: Mapped["HardwareReferenceEntry | None"] = relationship()
    # No cascade here — Accessory.linked_devices (the other side of this same join model)
    # already owns the cascade, same asymmetry as AccessoryCompatibility/HardwarePlatform.
    linked_accessories: Mapped[list["AccessoryDeviceLink"]] = relationship(back_populates="device")


class DeviceTag(Base):
    __tablename__ = "device_tags"

    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id"), primary_key=True)

    device: Mapped["Device"] = relationship()
    tag: Mapped["Tag"] = relationship()


class DeviceNote(TimestampMixin, Base):
    __tablename__ = "device_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"), index=True, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    device: Mapped["Device"] = relationship()


class Accessory(TimestampMixin, Base):
    """A master catalog row for one accessory SKU (e.g. "DualSense"). Compatibility with
    hardware platforms is many-to-many — see AccessoryCompatibility — rather than a single
    FK, since one accessory commonly works across several platforms/revisions. Separately,
    `linked_devices` (see AccessoryDeviceLink) ties it to specific Device catalog rows
    rather than just the broad platform — e.g. linking a DualSense to one specific PS5
    Slim, distinct from "DualSense is compatible with the PS5 platform generally."
    """

    __tablename__ = "accessories"
    __table_args__ = (UniqueConstraint("external_source", "external_id", name="uq_accessories_external_ref"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, default=lambda: str(uuid.uuid4()))

    manufacturer_id: Mapped[int] = mapped_column(ForeignKey("manufacturers.id"), nullable=False, index=True)
    accessory_type_id: Mapped[int] = mapped_column(ForeignKey("accessory_types.id"), nullable=False, index=True)

    official_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    model: Mapped[str | None] = mapped_column(String(255))
    revision: Mapped[str | None] = mapped_column(String(100))
    edition: Mapped[str | None] = mapped_column(String(255), comment="Free text, e.g. 'Spider-Man 2 Limited Edition'")

    # Year only, not a full date — Custom Accessory only ever collects a release year.
    release_date: Mapped[int | None] = mapped_column(Integer)

    color_id: Mapped[int | None] = mapped_column(ForeignKey("colors.id"))
    rating_board: Mapped[RatingBoard | None] = mapped_column(enum_column(RatingBoard))
    hardware_reference_entry_id: Mapped[int | None] = mapped_column(ForeignKey("hardware_reference_entries.id"))

    # Free text, only ever set by the Custom Add Accessory form — predefined accessories
    # instead show hardware_reference_entry.summary, which has no equivalent for a custom
    # (unlinked) accessory.
    summary: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(1024))

    external_source: Mapped[str | None] = mapped_column(String(100), index=True)
    external_id: Mapped[str | None] = mapped_column(String(100), index=True)

    manufacturer: Mapped["Manufacturer"] = relationship()
    accessory_type: Mapped["AccessoryType"] = relationship()
    color: Mapped["Color | None"] = relationship()
    hardware_reference_entry: Mapped["HardwareReferenceEntry | None"] = relationship()
    compatible_platforms: Mapped[list["AccessoryCompatibility"]] = relationship(
        back_populates="accessory", cascade="all, delete-orphan"
    )
    linked_devices: Mapped[list["AccessoryDeviceLink"]] = relationship(
        back_populates="accessory", cascade="all, delete-orphan"
    )
    # Outgoing accessory-to-accessory links (e.g. a protection case -> the controller it
    # fits) — edited from this accessory's own Add/Edit form. `linking_accessories` is the
    # read-only reverse view (other accessories that link to this one), same asymmetry as
    # Device.linked_accessories/Accessory.linked_devices above.
    linked_accessories: Mapped[list["AccessoryAccessoryLink"]] = relationship(
        foreign_keys="AccessoryAccessoryLink.accessory_id", back_populates="accessory", cascade="all, delete-orphan"
    )
    linking_accessories: Mapped[list["AccessoryAccessoryLink"]] = relationship(
        foreign_keys="AccessoryAccessoryLink.linked_accessory_id", back_populates="linked_accessory"
    )


class AccessoryCompatibility(Base):
    __tablename__ = "accessory_compatibility"

    accessory_id: Mapped[int] = mapped_column(ForeignKey("accessories.id"), primary_key=True)
    hardware_platform_id: Mapped[int] = mapped_column(ForeignKey("hardware_platforms.id"), primary_key=True)

    accessory: Mapped["Accessory"] = relationship(back_populates="compatible_platforms")
    hardware_platform: Mapped["HardwarePlatform"] = relationship()


class AccessoryDeviceLink(Base):
    """Links an accessory to a specific Device catalog row (not just its broad platform —
    see AccessoryCompatibility for that). Edited from the Accessory side (create/update
    accessory); Device.linked_accessories is the read-only reverse view shown on the
    Device detail page."""

    __tablename__ = "accessory_device_links"

    accessory_id: Mapped[int] = mapped_column(ForeignKey("accessories.id"), primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"), primary_key=True)

    accessory: Mapped["Accessory"] = relationship(back_populates="linked_devices")
    device: Mapped["Device"] = relationship(back_populates="linked_accessories")


class AccessoryAccessoryLink(Base):
    """Links one accessory to another (e.g. a protection case to the controller it fits) —
    self-referential, so both sides of the FK point at `accessories.id`. Edited from one
    accessory's side at a time; the Details page shows both directions (this accessory's own
    outgoing links plus any other accessory that links back to it) — see
    accessory_detail_from_orm."""

    __tablename__ = "accessory_accessory_links"

    accessory_id: Mapped[int] = mapped_column(ForeignKey("accessories.id"), primary_key=True)
    linked_accessory_id: Mapped[int] = mapped_column(ForeignKey("accessories.id"), primary_key=True)

    accessory: Mapped["Accessory"] = relationship(foreign_keys=[accessory_id], back_populates="linked_accessories")
    linked_accessory: Mapped["Accessory"] = relationship(
        foreign_keys=[linked_accessory_id], back_populates="linking_accessories"
    )


class AccessoryTag(Base):
    __tablename__ = "accessory_tags"

    accessory_id: Mapped[int] = mapped_column(ForeignKey("accessories.id"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id"), primary_key=True)

    accessory: Mapped["Accessory"] = relationship()
    tag: Mapped["Tag"] = relationship()


class AccessoryNote(TimestampMixin, Base):
    __tablename__ = "accessory_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    accessory_id: Mapped[int] = mapped_column(ForeignKey("accessories.id"), index=True, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    accessory: Mapped["Accessory"] = relationship()


class UserDevice(TimestampMixin, Base):
    """One row per owned/wishlisted device copy — mirrors LibraryItem's role for games.
    A second copy is always a separate row, identified by its own `serial_number`."""

    __tablename__ = "user_devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"), nullable=False, index=True)

    status: Mapped[LibraryStatus] = mapped_column(enum_column(LibraryStatus), nullable=False, index=True)
    condition: Mapped[HardwareCondition | None] = mapped_column(enum_column(HardwareCondition))

    purchase_price: Mapped[float | None] = mapped_column()
    serial_number: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

    device: Mapped["Device"] = relationship()


class UserAccessory(TimestampMixin, Base):
    __tablename__ = "user_accessories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    accessory_id: Mapped[int] = mapped_column(ForeignKey("accessories.id"), nullable=False, index=True)

    status: Mapped[LibraryStatus] = mapped_column(enum_column(LibraryStatus), nullable=False, index=True)
    condition: Mapped[HardwareCondition | None] = mapped_column(enum_column(HardwareCondition))

    purchase_price: Mapped[float | None] = mapped_column()
    serial_number: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

    accessory: Mapped["Accessory"] = relationship()
