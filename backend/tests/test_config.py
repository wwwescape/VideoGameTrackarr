from app.core.config import DEFAULT_SQLITE_PATH, Settings


def test_database_url_falls_back_to_sqlite_when_env_var_is_empty(monkeypatch):
    # Reproduces the docker-compose crash from issue #4: a documented "leave this blank
    # for SQLite" .env line (`DATABASE_URL=`) sets the env var to "", which
    # pydantic-settings would otherwise treat as "provided" and use verbatim instead of
    # falling back to Settings.database_url's default. Fixed via env_ignore_empty=True.
    monkeypatch.setenv("DATABASE_URL", "")

    settings = Settings(_env_file=None)

    assert settings.database_url == f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"


def test_database_url_uses_explicit_value_when_set(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost/db")

    settings = Settings(_env_file=None)

    assert settings.database_url == "postgresql://user:pass@localhost/db"


def test_redis_url_falls_back_to_none_when_env_var_is_empty(monkeypatch):
    monkeypatch.setenv("REDIS_URL", "")

    settings = Settings(_env_file=None)

    assert settings.redis_url is None
