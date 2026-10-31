import re

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

PCGAMINGWIKI_API_URL = "https://www.pcgamingwiki.com/w/api.php"

# PCGamingWiki asks API users to identify themselves; its Cargo query API is closed to
# anonymous use, so pages are read one by one through the plain MediaWiki parse action.
_USER_AGENT = "VideoGameTrackarr (self-hosted; https://github.com/wwwescape/VideoGameTrackarr)"

# Same reasoning as igdb_client.py's _retryable.
_retryable = retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)

_MULTIPLAYER_BLOCK = re.compile(r"\{\{Network/Multiplayer(.*?)\n\}\}", re.S)
_STEAM_APP_IDS = re.compile(r"\|steam appid\s*=\s*([\d, ]+)")


def _field(block: str, name: str) -> str:
    match = re.search(rf"\|{name}\s*=\s*([^\n|]*)", block)
    return match.group(1).strip().lower() if match else ""


def parse_local_players(wikitext: str) -> int | None:
    """Most players on one PC, out of a game page's Network/Multiplayer template: its
    "local play players" count when local play is supported, 2 when it's supported without a
    count, 1 when it isn't. "hackable" (only through a mod or ini edit), "limited" and
    "unknown" say nothing about playing it as shipped, so they give None."""
    block = _MULTIPLAYER_BLOCK.search(wikitext)
    if block is None:
        return None
    local_play = _field(block.group(1), "local play")
    if local_play == "false":
        return 1
    if local_play != "true":
        return None
    players = re.match(r"\d+", _field(block.group(1), "local play players"))
    return int(players.group()) if players else 2


class PCGamingWikiClient:
    """Reads PC games' multiplayer support from PCGamingWiki, the open wiki of PC game
    details — used where IGDB has no local player count (see players_fill_jobs.py). Pages
    are looked up by game name; when the Steam AppID is known, a page listing other AppIDs
    is taken as a different game with the same name and ignored."""

    def __init__(self, http_client: httpx.AsyncClient | None = None) -> None:
        self._http = http_client or httpx.AsyncClient(timeout=15.0, headers={"User-Agent": _USER_AGENT})

    async def aclose(self) -> None:
        await self._http.aclose()

    @_retryable
    async def _request(self, params: dict[str, str]) -> httpx.Response:
        response = await self._http.get(PCGAMINGWIKI_API_URL, params=params)
        response.raise_for_status()
        return response

    async def get_local_players(self, name: str, steam_app_id: int | None = None) -> int | None:
        response = await self._request(
            {
                "action": "parse",
                "page": name,
                "prop": "wikitext",
                "redirects": "1",
                "format": "json",
                "formatversion": "2",
            }
        )
        payload = response.json()
        if "error" in payload:
            return None
        wikitext = payload["parse"]["wikitext"]
        if steam_app_id is not None:
            listed = {int(app_id) for ids in _STEAM_APP_IDS.findall(wikitext) for app_id in re.findall(r"\d+", ids)}
            if listed and steam_app_id not in listed:
                return None
        return parse_local_players(wikitext)
