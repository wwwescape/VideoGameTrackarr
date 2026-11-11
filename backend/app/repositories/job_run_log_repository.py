from datetime import datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session, defer

from app.models.jobs import JobRunLog

RUNNING = "running"


def create(db: Session, job_id: str, trigger: str, started_at: datetime) -> JobRunLog:
    log = JobRunLog(job_id=job_id, trigger=trigger, status=RUNNING, started_at=started_at)
    db.add(log)
    db.flush()
    return log


def get(db: Session, job_id: str, log_id: int) -> JobRunLog | None:
    log = db.get(JobRunLog, log_id)
    return log if log is not None and log.job_id == job_id else None


def list_for_job(db: Session, job_id: str) -> list[JobRunLog]:
    """Newest first, without the (comparatively large) lines column."""
    return list(
        db.scalars(
            select(JobRunLog)
            .options(defer(JobRunLog.lines))
            .where(JobRunLog.job_id == job_id)
            .order_by(JobRunLog.started_at.desc(), JobRunLog.id.desc())
        )
    )


def latest(db: Session, job_id: str) -> JobRunLog | None:
    return db.scalars(
        select(JobRunLog)
        .options(defer(JobRunLog.lines))
        .where(JobRunLog.job_id == job_id)
        .order_by(JobRunLog.started_at.desc(), JobRunLog.id.desc())
        .limit(1)
    ).first()


def latest_started_at(db: Session, job_id: str) -> datetime | None:
    return db.scalar(select(func.max(JobRunLog.started_at)).where(JobRunLog.job_id == job_id))


def prune(db: Session, job_id: str, keep: int) -> int:
    """Deletes every finished log for job_id beyond the newest `keep` — a running row is never
    pruned, even if it's somehow older than the cutoff."""
    keep_ids = (
        select(JobRunLog.id)
        .where(JobRunLog.job_id == job_id)
        .order_by(JobRunLog.started_at.desc(), JobRunLog.id.desc())
        .limit(keep)
    )
    result = db.execute(
        delete(JobRunLog).where(
            JobRunLog.job_id == job_id,
            JobRunLog.status != RUNNING,
            JobRunLog.id.not_in(keep_ids.scalar_subquery()),
        )
    )
    return result.rowcount or 0


def clear(db: Session, job_id: str) -> int:
    result = db.execute(delete(JobRunLog).where(JobRunLog.job_id == job_id, JobRunLog.status != RUNNING))
    return result.rowcount or 0


def close_interrupted(db: Session, error: str) -> int:
    result = db.execute(update(JobRunLog).where(JobRunLog.status == RUNNING).values(status="failed", error=error))
    return result.rowcount or 0
