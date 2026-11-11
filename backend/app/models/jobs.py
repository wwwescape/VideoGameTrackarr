from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin, UTCDateTime


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


class JobRunLog(Base):
    """One run of a job_registry job — written when the run starts (status "running") and
    finalized when it ends, so it survives a restart that the in-memory run state doesn't.
    Only the newest job_run_log_service.MAX_LOGS_PER_JOB rows per job are kept. Deliberately
    outside backups and reset, like job_schedules: operational history, not library data."""

    __tablename__ = "job_run_logs"
    __table_args__ = (Index("ix_job_run_logs_job_id_started_at", "job_id", "started_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(100), nullable=False)
    # "manual", "scheduled" or "catch_up" (a scheduled fire missed while the app was down).
    trigger: Mapped[str] = mapped_column(String(20), nullable=False)
    # "running", "completed" or "failed" — a row still "running" at startup is from a run the
    # process died during, and is closed out as failed then.
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)
    # [{"t": ISO timestamp, "level": "INFO"|"WARNING"|"ERROR", "msg": str}, ...], capped.
    lines: Mapped[list[dict[str, str]] | None] = mapped_column(JSON)
