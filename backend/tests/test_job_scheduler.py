from unittest.mock import MagicMock

from app.models.jobs import JobSchedule
from app.services import job_scheduler


def test_start_schedules_every_enabled_row(db_session):
    db_session.add(JobSchedule(job_id="resync_collections", enabled=True, cron_expression="0 3 * * *"))
    db_session.add(JobSchedule(job_id="disabled_job", enabled=False, cron_expression="0 4 * * *"))
    db_session.commit()

    job_scheduler.start(db_session, MagicMock)

    assert job_scheduler._scheduler.get_job("resync_collections") is not None
    assert job_scheduler._scheduler.get_job("disabled_job") is None


def test_reschedule_disable_removes_the_job(db_session):
    job_scheduler.reschedule("resync_collections", True, "0 3 * * *", MagicMock)
    assert job_scheduler._scheduler.get_job("resync_collections") is not None

    job_scheduler.reschedule("resync_collections", False, None, MagicMock)
    assert job_scheduler._scheduler.get_job("resync_collections") is None


def test_get_next_run_time_reflects_a_scheduled_job():
    assert job_scheduler.get_next_run_time("resync_collections") is None

    job_scheduler.reschedule("resync_collections", True, "0 3 * * *", MagicMock)

    assert job_scheduler.get_next_run_time("resync_collections") is not None
