import time
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

from sqlalchemy.orm import Session

from app.models.jobs import JobRunLog, JobSchedule
from app.services import job_run_log_service, job_scheduler, resync_jobs


def _wait_for_completion(client, job_id: str, timeout: float = 5.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        body = client.get(f"/api/jobs/{job_id}/status").json()
        if body["run"]["status"] != "running":
            return body
        time.sleep(0.02)
    raise AssertionError("Job did not finish within the test timeout")


def _fake_resync(result=None, error=None):
    async def fake(db, scope, report_progress):
        report_progress(1, 2)
        report_progress(2, 2)
        if error:
            raise RuntimeError(error)
        return result

    return fake


def test_a_run_writes_a_log_with_lines(auth_client, monkeypatch):
    monkeypatch.setattr(
        resync_jobs,
        "_resync_all",
        _fake_resync(
            {
                "total": 2,
                "succeeded": 1,
                "failed": 1,
                "failures": [{"gameId": 7, "gameName": "Halo", "error": "gone from IGDB"}],
            }
        ),
    )
    auth_client.post("/api/jobs/resync_all/run")
    summary = _wait_for_completion(auth_client, "resync_all")

    assert summary["lastRun"]["status"] == "completed"
    assert summary["lastRun"]["trigger"] == "manual"

    logs = auth_client.get("/api/jobs/resync_all/logs").json()
    assert len(logs) == 1
    # The list carries counts only; the failures list lives in the detail.
    assert logs[0]["result"] == {"total": 2, "succeeded": 1, "failed": 1}

    detail = auth_client.get(f"/api/jobs/resync_all/logs/{logs[0]['id']}").json()
    messages = [line["msg"] for line in detail["lines"]]
    assert messages[0] == "Started (run manually)"
    assert "Working through 2 item(s)" in messages
    assert "Halo: gone from IGDB" in messages
    assert messages[-1].startswith("Completed in ")
    assert detail["result"]["failures"][0]["gameName"] == "Halo"


def test_a_failed_run_logs_the_error(auth_client, monkeypatch):
    monkeypatch.setattr(resync_jobs, "_resync_all", _fake_resync(error="IGDB is down"))
    auth_client.post("/api/jobs/resync_games/run")
    _wait_for_completion(auth_client, "resync_games")

    log = auth_client.get("/api/jobs/resync_games/logs").json()[0]
    assert log["status"] == "failed"
    assert log["error"] == "IGDB is down"
    detail = auth_client.get(f"/api/jobs/resync_games/logs/{log['id']}").json()
    assert any("Traceback" in line["msg"] and line["level"] == "ERROR" for line in detail["lines"])


def test_logs_are_pruned_to_the_newest_per_job(db_session, monkeypatch):
    monkeypatch.setattr(job_run_log_service, "MAX_LOGS_PER_JOB", 3)
    factory = lambda: Session(bind=db_session.bind)  # noqa: E731
    start = datetime(2026, 1, 1, tzinfo=UTC)
    for index in range(5):
        started = start + timedelta(hours=index)
        collector = job_run_log_service.begin("resync_all", "manual", started, factory)
        job_run_log_service.finish(collector, "completed", started, started, {"total": 0}, None, factory)

    logs = job_run_log_service.list_logs(db_session, "resync_all")
    assert [log.started_at.hour for log in logs] == [4, 3, 2]


def test_clear_keeps_other_jobs_and_404s(auth_client, db_session):
    now = datetime.now(UTC)
    db_session.add_all(
        [
            JobRunLog(job_id="resync_all", trigger="manual", status="completed", started_at=now),
            JobRunLog(job_id="resync_series", trigger="scheduled", status="completed", started_at=now),
        ]
    )
    db_session.commit()

    assert auth_client.delete("/api/jobs/resync_all/logs").status_code == 204
    assert auth_client.get("/api/jobs/resync_all/logs").json() == []
    assert len(auth_client.get("/api/jobs/resync_series/logs").json()) == 1
    assert auth_client.get("/api/jobs/resync_series/logs/99999").status_code == 404
    assert auth_client.get("/api/jobs/no_such_job/logs").status_code == 404


def test_startup_closes_interrupted_runs(db_session):
    db_session.add(JobRunLog(job_id="resync_all", trigger="manual", status="running", started_at=datetime.now(UTC)))
    db_session.commit()

    job_scheduler.start(db_session, MagicMock)

    log = job_run_log_service.list_logs(db_session, "resync_all")[0]
    assert log.status == "failed"
    assert log.error == job_run_log_service.INTERRUPTED_ERROR


def test_startup_catches_up_a_missed_scheduled_run(db_session):
    two_days_ago = datetime.now(UTC) - timedelta(days=2)
    db_session.add(JobSchedule(job_id="resync_collections", enabled=True, cron_expression="0 3 * * *"))
    db_session.add(
        JobRunLog(job_id="resync_collections", trigger="scheduled", status="completed", started_at=two_days_ago)
    )
    db_session.commit()

    job_scheduler.start(db_session, MagicMock)

    catch_up = job_scheduler._scheduler.get_job("resync_collections:catch_up")
    assert catch_up is not None
    assert catch_up.args[2] == "catch_up"


def test_startup_skips_catch_up_when_nothing_was_missed(db_session):
    db_session.add(JobSchedule(job_id="resync_series", enabled=True, cron_expression="0 3 * * *"))
    db_session.add(
        JobRunLog(job_id="resync_series", trigger="manual", status="completed", started_at=datetime.now(UTC))
    )
    db_session.commit()

    job_scheduler.start(db_session, MagicMock)

    assert job_scheduler._scheduler.get_job("resync_series") is not None
    assert job_scheduler._scheduler.get_job("resync_series:catch_up") is None


def test_disabling_a_schedule_cancels_a_pending_catch_up(db_session):
    db_session.add(JobSchedule(job_id="resync_games", enabled=True, cron_expression="0 3 * * *"))
    db_session.add(
        JobRunLog(
            job_id="resync_games",
            trigger="scheduled",
            status="completed",
            started_at=datetime.now(UTC) - timedelta(days=3),
        )
    )
    db_session.commit()
    job_scheduler.start(db_session, MagicMock)

    job_scheduler.reschedule("resync_games", False, None, MagicMock)

    assert job_scheduler._scheduler.get_job("resync_games:catch_up") is None
