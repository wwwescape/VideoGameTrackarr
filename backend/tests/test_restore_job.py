import threading
import time
from unittest.mock import MagicMock

import pytest

from app.schemas.backup import BackupPayload
from app.services import restore_job
from app.services.exceptions import ConflictError


def _empty_payload() -> BackupPayload:
    return BackupPayload(version=1, exported_at="2026-01-01T00:00:00+00:00")


def test_start_restore_rejects_a_concurrent_restore(monkeypatch):
    release = threading.Event()

    def blocking_restore_backup(session, payload):
        release.wait(timeout=2)
        return restore_job.BackupRestoreResult(restored_games=0, restored_library_items=0, safety_snapshot_path="x")

    monkeypatch.setattr(restore_job.backup_service, "restore_backup", blocking_restore_backup)

    try:
        first_state = restore_job.start_restore(_empty_payload(), session_factory=MagicMock)
        assert first_state.status == restore_job.RestoreJobStatus.RUNNING

        with pytest.raises(ConflictError):
            restore_job.start_restore(_empty_payload(), session_factory=MagicMock)
    finally:
        release.set()
        time.sleep(0.05)  # let the background thread finish before the next test's reset


def test_run_restore_records_failure_and_acknowledge_resets_to_idle():
    def failing_session_factory():
        raise RuntimeError("boom")

    restore_job._run_restore(_empty_payload(), failing_session_factory)

    state = restore_job.get_state()
    assert state.status == restore_job.RestoreJobStatus.FAILED
    assert "boom" in state.error

    restore_job.acknowledge()
    assert restore_job.get_state().status == restore_job.RestoreJobStatus.IDLE


def test_acknowledge_is_a_no_op_while_running(monkeypatch):
    release = threading.Event()

    def blocking_restore_backup(session, payload):
        release.wait(timeout=2)
        return restore_job.BackupRestoreResult(restored_games=0, restored_library_items=0, safety_snapshot_path="x")

    monkeypatch.setattr(restore_job.backup_service, "restore_backup", blocking_restore_backup)

    try:
        restore_job.start_restore(_empty_payload(), session_factory=MagicMock)
        restore_job.acknowledge()
        assert restore_job.get_state().status == restore_job.RestoreJobStatus.RUNNING
    finally:
        release.set()
        time.sleep(0.05)  # let the background thread finish before the next test's reset
