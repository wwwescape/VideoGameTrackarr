import json
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent
DEFAULT_SQLITE_PATH = BACKEND_DIR / "db" / "videogametrackarr.db"
UPLOADS_DIR = BACKEND_DIR / "uploads"
# Curated product shots for HardwareReferenceEntry rows — checked into the repo (unlike
# UPLOADS_DIR, which is gitignored runtime storage), one file per SKU. See the seed migration
# that backfills HardwareReferenceEntry.image_url for the naming convention.
HARDWARE_REFERENCE_IMAGES_DIR = BACKEND_DIR / "static" / "hardware-reference"


class Settings(BaseSettings):
    # Secrets live in one .env at the repo root (not backend/), so the same file works for
    # both local dev and the Docker Compose setup, which reads it from there too.
    model_config = SettingsConfigDict(env_file=str(REPO_ROOT / ".env"), extra="ignore")

    app_name: str = "VideoGameTrackarr API"
    environment: str = "development"
    log_level: str = "INFO"
    database_url: str = f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"

    # Auth. jwt_secret_key has no default on purpose — see app/core/security.py, which
    # fails loudly and only when auth is actually used, rather than baking in an insecure
    # default that would inevitably end up reused in production (a real, recurring CVE
    # pattern in other frameworks).
    jwt_secret_key: str | None = None
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    # IGDB credentials. No default — see app/services/igdb_client.py, which raises a clear
    # error rather than silently failing if these aren't set.
    igdb_client_id: str | None = None
    igdb_client_secret: str | None = None

    # Optional response cache backend — falls back to an in-process TTL cache if unset.
    redis_url: str | None = None

    # CORS allow-list. The Vite dev server's origin is included by default since that's the
    # only case where frontend and backend are genuinely cross-origin — in production,
    # FastAPI serves both from one origin (see the root README's "Deploying with Docker").
    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_app_version() -> str:
    """package.json's "version" is this app's single source of truth for its own displayed
    version (see app/api/routes/version.py) — not a Settings field, since it isn't
    env-configurable. Falls back to "0.0.0" rather than raising if the file is missing or
    malformed, so a bad read never breaks startup or the version check that depends on it."""
    try:
        package_json = json.loads((REPO_ROOT / "package.json").read_text())
        return str(package_json["version"])
    except (OSError, ValueError, KeyError):
        return "0.0.0"
