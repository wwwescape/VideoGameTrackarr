import pytest

from app.services import export_backup_job
from app.services.export_backup_job import ExportBackupError, _parse_smb_path, _sort_key
from app.services.job_registry import list_jobs


def test_parse_smb_path_unc():
    assert _parse_smb_path("\\\\SERVER\\Share\\Backups") == ("SERVER", "Share", "Backups")


def test_parse_smb_path_url():
    assert _parse_smb_path("smb://server/share") == ("server", "share", "")


def test_parse_smb_path_invalid():
    with pytest.raises(ExportBackupError):
        _parse_smb_path("\\\\SERVER")


def test_export_filename_matches_scheduled_and_manual():
    assert export_backup_job.EXPORT_FILENAME_RE.match("videogametrackarr-backup-20261026-120000.json")
    assert export_backup_job.EXPORT_FILENAME_RE.match("videogametrackarr-backup.json")
    assert export_backup_job.EXPORT_FILENAME_RE.match("videogametrackarr-full-backup.zip")
    assert not export_backup_job.EXPORT_FILENAME_RE.match("some-other-file.json")


def test_sort_key_orders_timestamped_after_manual_and_chronologically():
    names = [
        "videogametrackarr-backup-20261026-120000.json",
        "videogametrackarr-backup.json",
        "videogametrackarr-backup-20261025-120000.json",
    ]
    assert sorted(names, key=_sort_key) == [
        "videogametrackarr-backup.json",
        "videogametrackarr-backup-20261025-120000.json",
        "videogametrackarr-backup-20261026-120000.json",
    ]


def test_export_backup_job_is_registered():
    assert "export_backup" in [definition.id for definition in list_jobs()]


def test_get_config_defaults(test_user):
    config = export_backup_job.get_config(test_user)
    assert config["smb_path"] is None
    assert config["has_password"] is False
    assert config["retention_count"] is None
    assert config["include_files"] is False


def test_set_config_stores_values_and_password_flag(db_session, test_user):
    export_backup_job.set_config(
        db_session,
        test_user,
        smb_path="\\\\SERVER\\Share\\Backups",
        smb_username="backup-user",
        smb_password="secret",
        retention_count=5,
        include_files=True,
    )
    config = export_backup_job.get_config(test_user)
    assert config["smb_path"] == "\\\\SERVER\\Share\\Backups"
    assert config["smb_username"] == "backup-user"
    assert config["has_password"] is True
    assert config["retention_count"] == 5
    assert config["include_files"] is True


def test_set_config_password_none_keeps_and_empty_clears(db_session, test_user):
    export_backup_job.set_config(
        db_session, test_user, smb_path=None, smb_username=None,
        smb_password="secret", retention_count=None, include_files=False,
    )
    export_backup_job.set_config(
        db_session, test_user, smb_path=None, smb_username=None,
        smb_password=None, retention_count=None, include_files=False,
    )
    assert export_backup_job.get_config(test_user)["has_password"] is True
    export_backup_job.set_config(
        db_session, test_user, smb_path=None, smb_username=None,
        smb_password="", retention_count=None, include_files=False,
    )
    assert export_backup_job.get_config(test_user)["has_password"] is False


def test_set_config_rejects_retention_below_one(db_session, test_user):
    with pytest.raises(ExportBackupError):
        export_backup_job.set_config(
            db_session, test_user, smb_path=None, smb_username=None,
            smb_password=None, retention_count=0, include_files=False,
        )


def test_export_job_config_requires_auth(client):
    assert client.get("/api/export/job-config").status_code == 401


def test_export_job_config_round_trip(auth_client):
    response = auth_client.get("/api/export/job-config")
    assert response.status_code == 200
    assert response.json() == {
        "smbPath": None,
        "smbUsername": None,
        "hasPassword": False,
        "retentionCount": None,
        "includeFiles": False,
    }

    response = auth_client.put(
        "/api/export/job-config",
        json={
            "smbPath": "\\\\SERVER\\Share\\Backups",
            "smbUsername": "backup-user",
            "smbPassword": "secret",
            "retentionCount": 5,
            "includeFiles": False,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["smbPath"] == "\\\\SERVER\\Share\\Backups"
    assert body["hasPassword"] is True
    assert body["retentionCount"] == 5


def test_export_job_config_rejects_bad_retention(auth_client):
    response = auth_client.put(
        "/api/export/job-config",
        json={"smbPath": None, "smbUsername": None, "smbPassword": None, "retentionCount": 0, "includeFiles": False},
    )
    assert response.status_code == 400


def test_export_job_test_connection_without_path_fails(auth_client):
    response = auth_client.post(
        "/api/export/job-config/test",
        json={"smbPath": None, "smbUsername": None, "smbPassword": None},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["message"]
