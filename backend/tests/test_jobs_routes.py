import time


def _wait_for_completion(client, job_id: str, timeout: float = 5.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        body = client.get(f"/api/jobs/{job_id}/status").json()
        if body["run"]["status"] != "running":
            return body
        time.sleep(0.02)
    raise AssertionError("Job did not finish within the test timeout")


def test_list_jobs_requires_auth(client):
    response = client.get("/api/jobs")

    assert response.status_code == 401


def test_list_jobs_shows_all_four_registered_jobs_idle(auth_client):
    response = auth_client.get("/api/jobs")

    assert response.status_code == 200
    jobs = {job["id"]: job for job in response.json()}
    # Not an exact-list assertion — test_job_registry.py registers its own
    # "dummy_job_for_tests" job process-wide, which shows up here too when both test files
    # run in the same pytest process.
    for job_id in ("resync_all", "resync_games", "resync_collections", "resync_series"):
        assert jobs[job_id]["run"]["status"] == "idle"
        assert jobs[job_id]["schedule"] == {"enabled": False, "cronExpression": None, "nextRunAt": None}


def test_run_job_transitions_to_completed(auth_client, monkeypatch):
    from app.services import resync_jobs

    async def fake_resync_all(db, scope):
        return {"total": 0, "succeeded": 0, "failed": 0, "failures": []}

    monkeypatch.setattr(resync_jobs, "_resync_all", fake_resync_all)

    response = auth_client.post("/api/jobs/resync_all/run")
    assert response.status_code == 202

    final = _wait_for_completion(auth_client, "resync_all")
    assert final["run"]["status"] == "completed"
    assert final["run"]["result"]["total"] == 0


def test_run_unknown_job_returns_404(auth_client):
    response = auth_client.post("/api/jobs/no_such_job/run")

    assert response.status_code == 404


def test_update_schedule_with_bad_cron_returns_400(auth_client):
    response = auth_client.put(
        "/api/jobs/resync_all/schedule", json={"enabled": True, "cronExpression": "not a cron"}
    )

    assert response.status_code == 400


def test_update_schedule_with_valid_cron_returns_next_run(auth_client):
    response = auth_client.put(
        "/api/jobs/resync_all/schedule", json={"enabled": True, "cronExpression": "0 3 * * *"}
    )

    assert response.status_code == 200
    schedule = response.json()["schedule"]
    assert schedule["enabled"] is True
    assert schedule["cronExpression"] == "0 3 * * *"
    assert schedule["nextRunAt"] is not None

    disable_response = auth_client.put(
        "/api/jobs/resync_all/schedule", json={"enabled": False, "cronExpression": None}
    )
    assert disable_response.status_code == 200
    assert disable_response.json()["schedule"]["nextRunAt"] is None
