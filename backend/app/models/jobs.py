from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class JobSchedule(TimestampMixin, Base):
    """Persisted cron schedule for a job_registry.JobDefinition, keyed by its stable string
    id — one row per job, created lazily on first schedule save (see
    app/services/job_schedule_service.py), not pre-seeded per registered job. One deliberate
    exception: `events_sync` gets a pre-seeded daily-3am row via migration 8fc830fe0d0e, since
    it's the only job where a brand-new instance otherwise has no way to show real content
    without a user first knowing to go schedule it manually — still fully user-editable
    afterward via the normal Settings -> Jobs UI, same as every other job."""

    __tablename__ = "job_schedules"

    job_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    cron_expression: Mapped[str | None] = mapped_column(String(100))
