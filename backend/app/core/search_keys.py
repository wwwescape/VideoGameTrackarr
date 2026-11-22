"""Punctuation-, space-, case- and accent-insensitive search keys.

A search key is a name reduced to its letters and digits: "GTA V" → "gtav", "Pokémon: Let's
Go" → "pokemonletsgo". Matching a query's key against a stored key makes "gtav" find "GTA V"
and "pokemon" find "Pokémon". Non-Latin letters (e.g. CJK titles) are letters too, so they
stay in the key.
"""

import unicodedata
from typing import Any


def search_key(text: str | None) -> str:
    if not text:
        return ""
    # NFKD splits "é" into "e" + a combining accent (dropped by isalnum below) and folds
    # compatibility forms (fullwidth letters, ligatures) into their plain letters.
    decomposed = unicodedata.normalize("NFKD", text).casefold()
    return "".join(ch for ch in decomposed if ch.isalnum())


def alternative_names_from_igdb(
    game_name: str | None, entries: list[dict[str, Any]] | None
) -> list[tuple[str, str | None]]:
    """IGDB's alternative_names entries for a game, as (name, comment) pairs worth storing:
    blanks dropped, and any name whose search key repeats the game's own or an earlier entry's
    ("GTAV" after "GTA V") left out, since search already finds it through that one."""
    seen = {search_key(game_name)}
    names: list[tuple[str, str | None]] = []
    for entry in entries or []:
        name = (entry.get("name") or "").strip()
        key = search_key(name)
        if not key or key in seen:
            continue
        seen.add(key)
        comment = (entry.get("comment") or "").strip() or None
        names.append((name[:512], comment[:255] if comment else None))
    return names
