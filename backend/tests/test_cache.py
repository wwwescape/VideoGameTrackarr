import pytest

from app.core.config import get_settings
from app.services.cache import InMemoryTTLCache, RedisCache, get_cache


@pytest.fixture(autouse=True)
def _clear_cache_singleton():
    get_cache.cache_clear()
    yield
    get_cache.cache_clear()


class FakeClock:
    def __init__(self, start: float = 0.0):
        self.now = start

    def __call__(self) -> float:
        return self.now


async def test_in_memory_cache_returns_stored_value():
    cache = InMemoryTTLCache(clock=FakeClock())

    await cache.set("key", "value", ttl_seconds=60)

    assert await cache.get("key") == "value"


async def test_in_memory_cache_expires_entries():
    clock = FakeClock()
    cache = InMemoryTTLCache(clock=clock)

    await cache.set("key", "value", ttl_seconds=10)
    clock.now += 11

    assert await cache.get("key") is None


async def test_in_memory_cache_missing_key_returns_none():
    cache = InMemoryTTLCache(clock=FakeClock())

    assert await cache.get("missing") is None


def test_get_cache_defaults_to_in_memory(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    get_settings.cache_clear()

    assert isinstance(get_cache(), InMemoryTTLCache)

    get_settings.cache_clear()


def test_get_cache_uses_redis_when_configured(monkeypatch):
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    get_settings.cache_clear()

    assert isinstance(get_cache(), RedisCache)

    monkeypatch.delenv("REDIS_URL", raising=False)
    get_settings.cache_clear()
