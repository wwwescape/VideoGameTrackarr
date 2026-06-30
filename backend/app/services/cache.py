import time
from collections.abc import Callable
from functools import lru_cache
from typing import Protocol

from app.core.config import get_settings


class CacheBackend(Protocol):
    async def get(self, key: str) -> str | None: ...
    async def set(self, key: str, value: str, ttl_seconds: int) -> None: ...


class InMemoryTTLCache:
    """Default backend — no external services required. Single-process only, so it's
    correct for one self-hosted instance but won't be shared across multiple replicas;
    that's what RedisCache is for."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._store: dict[str, tuple[float, str]] = {}

    async def get(self, key: str) -> str | None:
        entry = self._store.get(key)
        if entry is None:
            return None

        expires_at, value = entry
        if self._clock() >= expires_at:
            del self._store[key]
            return None

        return value

    async def set(self, key: str, value: str, ttl_seconds: int) -> None:
        self._store[key] = (self._clock() + ttl_seconds, value)


class RedisCache:
    """Used automatically when REDIS_URL is configured, so a multi-replica or
    higher-traffic deployment can share one cache instead of each process keeping its own."""

    def __init__(self, redis_url: str) -> None:
        import redis.asyncio as redis_asyncio

        self._client = redis_asyncio.from_url(redis_url)

    async def get(self, key: str) -> str | None:
        value = await self._client.get(key)
        return value.decode("utf-8") if value is not None else None

    async def set(self, key: str, value: str, ttl_seconds: int) -> None:
        await self._client.set(key, value, ex=ttl_seconds)


@lru_cache
def get_cache() -> CacheBackend:
    settings = get_settings()
    if settings.redis_url:
        return RedisCache(settings.redis_url)
    return InMemoryTTLCache()
