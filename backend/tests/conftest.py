import os

# Must happen before any `app.core.config` import anywhere in the test session — Settings
# is read once and cached, so the secret needs to exist before the first import, not
# inside a fixture (which would run too late for module-level imports in test files).
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-do-not-use-outside-pytest")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_igdb_client
from app.core.config import get_settings
from app.core.limiter import limiter
from app.core.security import hash_password
from app.main import app
from app.models import Base
from app.models.catalog import Game, GameCategory, Platform, Region
from app.models.hardware import Accessory, AccessoryType, Device, DeviceType, HardwarePlatform, Manufacturer
from app.models.system import User
from app.services.cache import InMemoryTTLCache
from app.services.igdb_client import IGDBClient

get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    # Without this, the 5/minute login limit (a deliberate, real rate limit — see
    # app/api/routes/auth.py) would leak across test functions, since slowapi's in-memory
    # storage is process-global, not per-test.
    limiter.reset()
    yield


@pytest.fixture()
def db_session(tmp_path):
    engine = create_engine(f"sqlite:///{(tmp_path / 'test.db').as_posix()}")
    Base.metadata.create_all(engine)
    session = Session(bind=engine)
    yield session
    session.close()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def test_user(db_session):
    user = User(username="admin", password_hash=hash_password("correct-password"))
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture()
def auth_client(client, test_user):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    token = login.json()["accessToken"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest.fixture()
def igdb_client():
    """A real IGDBClient (so respx can mock its HTTP calls in individual tests), wired in
    via dependency override so routes get this instance instead of the lifespan-created
    one on app.state."""
    test_client = IGDBClient(client_id="test-client-id", client_secret="test-client-secret", cache=InMemoryTTLCache())
    app.dependency_overrides[get_igdb_client] = lambda: test_client
    yield test_client
    app.dependency_overrides.pop(get_igdb_client, None)


@pytest.fixture()
def seed_platform(db_session):
    platform = Platform(name="PlayStation 5", slug="ps5")
    db_session.add(platform)
    db_session.commit()
    return platform


@pytest.fixture()
def seed_region(db_session):
    region = Region(name="PAL")
    db_session.add(region)
    db_session.commit()
    return region


@pytest.fixture()
def seed_game(db_session):
    game = Game(igdb_id=1001, name="Test Game", slug="test-game", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    return game


@pytest.fixture()
def seed_manufacturer(db_session):
    manufacturer = Manufacturer(name="Sony")
    db_session.add(manufacturer)
    db_session.commit()
    return manufacturer


@pytest.fixture()
def seed_device_type(db_session):
    device_type = DeviceType(name="Console")
    db_session.add(device_type)
    db_session.commit()
    return device_type


@pytest.fixture()
def seed_accessory_type(db_session):
    accessory_type = AccessoryType(name="Controller")
    db_session.add(accessory_type)
    db_session.commit()
    return accessory_type


@pytest.fixture()
def seed_hardware_platform(db_session):
    platform = HardwarePlatform(name="PlayStation 5")
    db_session.add(platform)
    db_session.commit()
    return platform


@pytest.fixture()
def seed_device(db_session, seed_manufacturer, seed_device_type, seed_hardware_platform):
    device = Device(
        manufacturer_id=seed_manufacturer.id,
        device_type_id=seed_device_type.id,
        hardware_platform_id=seed_hardware_platform.id,
        official_name="Test Console",
    )
    db_session.add(device)
    db_session.commit()
    return device


@pytest.fixture()
def seed_accessory(db_session, seed_manufacturer, seed_accessory_type):
    accessory = Accessory(
        manufacturer_id=seed_manufacturer.id,
        accessory_type_id=seed_accessory_type.id,
        official_name="Test Controller",
    )
    db_session.add(accessory)
    db_session.commit()
    return accessory
