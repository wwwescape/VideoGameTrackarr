import enum
from datetime import UTC, datetime

from sqlalchemy import DateTime, Enum, func
from sqlalchemy.engine import Dialect
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator


def as_utc(value: datetime) -> datetime:
    """Naive datetimes are taken to already be UTC; aware ones are converted to it."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class UTCDateTime(TypeDecorator[datetime]):
    """A `UTCDateTime()` that always round-trips as an aware UTC datetime.
    SQLite has no timezone-aware column type, so it drops the offset on write and reads
    back a naive value — which the API then serialized without a `Z`, and browsers parse
    a zone-less ISO string as *local* time, shifting every timestamp by the viewer's
    offset. Normalizing to UTC on write and re-attaching UTC on read fixes that for
    every dialect (Postgres already returns aware values, which pass through)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        return as_utc(value) if value is not None else None

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        return as_utc(value) if value is not None else None


def enum_column(python_enum: type[enum.Enum]) -> Enum:
    """Store the Enum's lowercase `.value` (not its uppercase `.name`) with a real CHECK
    constraint — neither is SQLAlchemy's default for native_enum=False, so this has to be
    explicit rather than relying on `Enum(python_enum, native_enum=False)` alone."""
    return Enum(
        python_enum,
        native_enum=False,
        create_constraint=True,
        values_callable=lambda obj: [member.value for member in obj],
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
