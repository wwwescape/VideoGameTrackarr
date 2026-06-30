import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, func
from sqlalchemy.orm import Mapped, mapped_column


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
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
