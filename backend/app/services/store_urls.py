"""A custom game's Store URL: one pasted address, recognised by its host and stored in the same
per-store column an IGDB game's store link would use (so it shows the same store icon)."""

from urllib.parse import urlparse

# Game column -> host suffixes that belong to that store. A host matches a suffix when it is
# the suffix or ends with "." + suffix.
STORE_HOSTS: dict[str, tuple[str, ...]] = {
    "steam_store_url": ("steampowered.com", "steamcommunity.com"),
    "xbox_store_url": ("xbox.com", "microsoft.com"),
    "playstation_store_url": ("playstation.com",),
    "nintendo_store_url": (
        "nintendo.com",
        "nintendo.co.uk",
        "nintendo.co.jp",
        "nintendo.de",
        "nintendo.fr",
        "nintendo.es",
        "nintendo.it",
        "nintendo.nl",
        "nintendo.com.au",
        "nintendo.co.nz",
    ),
    "epic_games_store_url": ("epicgames.com",),
    "gog_store_url": ("gog.com",),
}

STORE_URL_FIELDS = tuple(STORE_HOSTS)


def store_field_for_url(url: str) -> str | None:
    """The Game column for a store link, or None when it isn't an http(s) link to a known store."""
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return None
    host = parsed.hostname.lower()
    for field, suffixes in STORE_HOSTS.items():
        if any(host == suffix or host.endswith("." + suffix) for suffix in suffixes):
            return field
    return None


def store_url_columns(url: str | None) -> dict[str, str | None]:
    """Every store column for a custom game's single Store URL: the recognised store's set to the
    link, the others cleared. Raises ValueError for an address that isn't a known store."""
    columns: dict[str, str | None] = {field: None for field in STORE_URL_FIELDS}
    if url and url.strip():
        field = store_field_for_url(url)
        if field is None:
            raise ValueError("not a Steam, Xbox, PlayStation, Nintendo, Epic Games or GOG store link")
        columns[field] = url.strip()
    return columns
