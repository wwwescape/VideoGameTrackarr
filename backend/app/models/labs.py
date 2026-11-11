from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class LabFeature(TimestampMixin, Base):
    """Settings > Labs: an experimental feature turned on or off for the whole app (the share
    page included). A lab with no row is off. The known labs live in app/services/labs.py."""

    __tablename__ = "lab_features"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
