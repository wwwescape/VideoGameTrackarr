import threading
import time
from unittest.mock import MagicMock

import pytest

from app.services import job_registry
from app.services.exceptions import ConflictError, NotFoundError
from app.services.job_registry import JobDefinition

DUMMY_JOB_ID = "dummy_job_for_tests"

# Registered once at module import time — job_registry.register raises on a duplicate id,
# and _definitions is a process-global dict never cleared by reset_for_tests() (registrations
# are meant to be process-lifetime, same as job_definitions.register_builtin_jobs() in
# app/main.py's lifespan), so registering inside each test function would fail on the second
# test to run. _run (module-level, mutable) lets each test swap in its own behavior without
# re-registering.
_run: object = None


def _run_dispatch(session_factory):
    return _run(session_factory)


job_registry.register(JobDefinition(id=DUMMY_JOB_ID, run=_run_dispatch))


def test_trigger_run_rejects_a_concurrent_run():
    global _run
    release = threading.Event()

    def blocking_run(session_factory):
        release.wait(timeout=2)
        return {"ok": True}

    _run = blocking_run

    try:
        first_state = job_registry.trigger_run(DUMMY_JOB_ID, session_factory=MagicMock)
        assert first_state.status == job_registry.JobRunStatus.RUNNING

        with pytest.raises(ConflictError):
            job_registry.trigger_run(DUMMY_JOB_ID, session_factory=MagicMock)
    finally:
        release.set()
        time.sleep(0.05)  # let the background thread finish before the next test's reset


def test_trigger_run_raises_not_found_for_unregistered_job():
    with pytest.raises(NotFoundError):
        job_registry.trigger_run("no_such_job", session_factory=MagicMock)


def test_get_state_raises_not_found_for_unregistered_job():
    with pytest.raises(NotFoundError):
        job_registry.get_state("no_such_job")


def test_a_failing_job_flips_to_failed_with_the_error_captured():
    global _run

    def failing_run(session_factory):
        raise RuntimeError("boom")

    _run = failing_run

    job_registry.trigger_run(DUMMY_JOB_ID, session_factory=MagicMock)
    time.sleep(0.1)

    state = job_registry.get_state(DUMMY_JOB_ID)
    assert state.status == job_registry.JobRunStatus.FAILED
    assert "boom" in state.error


def test_acknowledge_resets_completed_to_idle():
    global _run
    _run = lambda session_factory: {"succeeded": 1}  # noqa: E731

    job_registry.trigger_run(DUMMY_JOB_ID, session_factory=MagicMock)
    time.sleep(0.1)
    assert job_registry.get_state(DUMMY_JOB_ID).status == job_registry.JobRunStatus.COMPLETED

    job_registry.acknowledge(DUMMY_JOB_ID)
    assert job_registry.get_state(DUMMY_JOB_ID).status == job_registry.JobRunStatus.IDLE


def test_acknowledge_is_a_no_op_while_running():
    global _run
    release = threading.Event()

    def blocking_run(session_factory):
        release.wait(timeout=2)
        return {"ok": True}

    _run = blocking_run

    try:
        job_registry.trigger_run(DUMMY_JOB_ID, session_factory=MagicMock)
        job_registry.acknowledge(DUMMY_JOB_ID)
        assert job_registry.get_state(DUMMY_JOB_ID).status == job_registry.JobRunStatus.RUNNING
    finally:
        release.set()
        time.sleep(0.05)
