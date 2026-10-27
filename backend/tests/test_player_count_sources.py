import asyncio

import pytest

from app.models.catalog import Game, GameCategory, GamePlatform, Platform
from app.models.library import LibraryItem, LibraryStatus
from app.services import players_fill_jobs
from app.services.pcgamingwiki_client import parse_local_players
from app.services.steam_store_client import local_players_from_categories


def _wiki_page(**fields: str) -> str:
    rows = "".join(f"\n|{name.replace('_', ' ')} = {value}" for name, value in fields.items())
    return "{{Infobox game}}\n{{Network/Multiplayer" + rows + "\n}}\n"


@pytest.mark.parametrize(
    ("fields", "expected"),
    [
        ({"local_play": "true", "local_play_players": "8"}, 8),
        # Supported without a count: two at least.
        ({"local_play": "true", "local_play_players": ""}, 2),
        ({"local_play": "false"}, 1),
        # Only through a mod or ini edit (Divinity: Original Sin II), or not known.
        ({"local_play": "hackable", "local_play_players": "4"}, None),
        ({"local_play": "unknown"}, None),
    ],
)
def test_pcgamingwiki_local_play(fields, expected):
    assert parse_local_players(_wiki_page(**fields)) == expected


def test_a_pcgamingwiki_page_without_a_multiplayer_section_says_nothing():
    assert parse_local_players("{{Infobox game}}") is None


@pytest.mark.parametrize(
    ("categories", "expected"),
    [
        ({1, 9, 24, 39, 62}, 2),  # Pico Park: Shared/Split Screen
        ({2, 22, 23, 62}, 1),  # single-player, plus achievements, cloud saves, Family Sharing
        ({1, 2, 36}, None),  # online PvP: nothing about one screen
    ],
)
def test_steam_store_categories(categories, expected):
    assert local_players_from_categories(categories) == expected


def test_the_fill_job_asks_pcgamingwiki_then_steam_for_library_games_igdb_has_no_count_for(db_session, monkeypatch):
    pc = Platform(name="PC (Microsoft Windows)", slug="win", igdb_id=6)
    db_session.add(pc)
    wiki_game = Game(name="Pico Park", category=GameCategory.MAIN_GAME)
    store_game = Game(name="Narvas", category=GameCategory.MAIN_GAME)
    counted = Game(name="Counted", category=GameCategory.MAIN_GAME, local_players=4)
    not_owned = Game(name="Not Owned", category=GameCategory.MAIN_GAME)
    db_session.add_all([wiki_game, store_game, counted, not_owned])
    db_session.flush()
    for game in (wiki_game, store_game, counted):
        db_session.add(LibraryItem(game_id=game.id, platform_id=pc.id, status=LibraryStatus.OWNED))
        db_session.add(GamePlatform(game_id=game.id, platform_id=pc.id))
    db_session.commit()
    asked: list[str] = []

    class FakeWiki:
        async def get_local_players(self, name, steam_app_id=None):
            asked.append(name)
            return 8 if name == "Pico Park" else None

        async def aclose(self):
            pass

    class FakeStore:
        async def get_local_players(self, app_id):
            return 2

        async def aclose(self):
            pass

    monkeypatch.setattr(players_fill_jobs, "PCGamingWikiClient", FakeWiki)
    monkeypatch.setattr(players_fill_jobs, "SteamStoreClient", FakeStore)
    monkeypatch.setattr(players_fill_jobs, "_PACE_DELAY_SECONDS", 0)

    result = asyncio.run(players_fill_jobs._fill(db_session, lambda current, total: None))

    assert (result["total"], result["found"]) == (2, 1)
    assert sorted(asked) == ["Narvas", "Pico Park"]
    db_session.expire_all()
    assert (wiki_game.local_players_fallback, wiki_game.local_players_fallback_source) == (8, "pcgamingwiki")
    # Not matched to Steam, so no store lookup: no count rather than a guess.
    assert store_game.local_players_fallback is None
