import json
import re
from collections.abc import Iterator
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx

from app.core.config import DEFAULT_SQLITE_PATH

# blawar/titledb: the community-maintained Nintendo Switch title list, per eShop region. The
# UK list first so a title gets its European name, then the US one for what it doesn't have.
TITLEDB_BASE_URL = "https://raw.githubusercontent.com/blawar/titledb/master/"
TITLEDB_REGIONS = ("GB.en.json", "US.en.json")

# The compact index (title ID -> name, players), next to the database so it's on the same
# persistent volume. A few MB, against ~90 MB per region file.
INDEX_PATH = DEFAULT_SQLITE_PATH.parent / "nintendo-titledb.json"

_CHUNK_SIZE = 1 << 20


@dataclass(frozen=True)
class NintendoTitle:
    name: str
    # Most players the eShop lists, which for a Switch game means on one console.
    players: int | None


def clean_name(name: str) -> str:
    name = re.sub(r"[™®©]", "", name)
    name = re.sub(r"\s*[–-]\s*Nintendo Switch\s*2?\s*Edition\s*$", "", name, flags=re.IGNORECASE)
    return " ".join(name.split())


def iter_entries(path: Path) -> Iterator[dict[str, Any]]:
    """The values of a titledb region file (one JSON object keyed by eShop id), decoded one
    at a time: json.load on the whole ~90 MB file would take close to a gigabyte of memory,
    which a Raspberry Pi running the app can't spare."""
    decoder = json.JSONDecoder()
    buffer = ""
    with path.open(encoding="utf-8") as file:
        buffer = file.read(_CHUNK_SIZE).lstrip().removeprefix("{")
        while True:
            # Skip separators and the next key; what's left starts with the value object.
            value_start = buffer.find("{")
            while value_start == -1 or value_start + 1 >= len(buffer):
                chunk = file.read(_CHUNK_SIZE)
                if not chunk:
                    return
                buffer += chunk
                value_start = buffer.find("{")
            try:
                entry, end = decoder.raw_decode(buffer, value_start)
            except json.JSONDecodeError:
                chunk = file.read(_CHUNK_SIZE)
                if not chunk:
                    return
                buffer += chunk
                continue
            yield entry
            buffer = buffer[end:]


def build_index(paths: list[Path]) -> dict[str, dict[str, Any]]:
    """Base titles only (an application's title ID ends in 000; updates and DLC don't), the
    shortest name a title has across regions, and the highest player count listed."""
    titles: dict[str, dict[str, Any]] = {}
    for path in paths:
        for entry in iter_entries(path):
            title_id = (entry.get("id") or "").upper()
            if len(title_id) != 16 or not title_id.endswith("000") or not entry.get("name"):
                continue
            players = entry.get("numberOfPlayers")
            players = int(players) if str(players or "").isdigit() else None
            name = clean_name(entry["name"])
            known = titles.get(title_id)
            if known is None:
                titles[title_id] = {"name": name, "players": players}
                continue
            if len(name) < len(known["name"]):
                known["name"] = name
            known["players"] = max(filter(None, (players, known["players"])), default=None)
    return titles


async def refresh_index(http_client: httpx.AsyncClient | None = None) -> int:
    """Downloads each region file to disk (streamed), rebuilds the index from them and swaps
    it in. Returns how many titles it has."""
    client = http_client or httpx.AsyncClient(timeout=300.0, follow_redirects=True)
    downloads: list[Path] = []
    try:
        for region in TITLEDB_REGIONS:
            target = INDEX_PATH.with_name(f".{region}.download")
            async with client.stream("GET", TITLEDB_BASE_URL + region) as response:
                response.raise_for_status()
                with target.open("wb") as file:
                    async for chunk in response.aiter_bytes(_CHUNK_SIZE):
                        file.write(chunk)
            downloads.append(target)
        titles = build_index(downloads)
    finally:
        for path in downloads:
            path.unlink(missing_ok=True)
        if http_client is None:
            await client.aclose()
    temporary = INDEX_PATH.with_suffix(".tmp")
    temporary.write_text(json.dumps(titles, ensure_ascii=False))
    temporary.replace(INDEX_PATH)
    load_index.cache_clear()
    return len(titles)


@lru_cache(maxsize=1)
def load_index() -> dict[str, dict[str, Any]]:
    if not INDEX_PATH.exists():
        return {}
    return json.loads(INDEX_PATH.read_text(encoding="utf-8"))


def get_title(title_id: str) -> NintendoTitle | None:
    """A base title by its 16-hex-digit ID (an update's ID gives its base game)."""
    title_id = title_id.upper()
    title = load_index().get(title_id[:13] + "000")
    return NintendoTitle(name=title["name"], players=title["players"]) if title else None
