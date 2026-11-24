"""Shared helper for streaming an upload to private storage (ROMs, BIOS files, guides)."""

from collections.abc import Callable
from pathlib import Path
from typing import BinaryIO

CHUNK_SIZE = 1024 * 1024


def stream_to_path(
    source: BinaryIO,
    final_path: Path,
    max_bytes: int,
    too_large: Callable[[], Exception],
    empty: Callable[[], Exception],
) -> int:
    """Streams `source` to `final_path` via a .part file, enforcing max_bytes (raising
    too_large()) and refusing an empty upload (raising empty()). Returns the size written;
    leaves nothing behind on failure. The caller has already checked final_path is inside
    its storage folder."""
    final_path.parent.mkdir(parents=True, exist_ok=True)
    part_path = final_path.with_name(final_path.name + ".part")
    size = 0
    try:
        with part_path.open("wb") as out:
            while chunk := source.read(CHUNK_SIZE):
                size += len(chunk)
                if size > max_bytes:
                    raise too_large()
                out.write(chunk)
        if size == 0:
            raise empty()
        part_path.replace(final_path)
    except BaseException:
        part_path.unlink(missing_ok=True)
        raise
    return size
