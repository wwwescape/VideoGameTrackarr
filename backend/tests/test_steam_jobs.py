from datetime import UTC, datetime

import pytest

from app.core.config import get_settings
from app.models.catalog import Game, GameCategory
from app.models.library import LibraryItem, LibraryStatus
from app.models.steam import SteamLibraryEntry
from app.repositories import game_progress_repository, steam_repository
from app.services import steam_jobs
from app.services.igdb_client import IGDBClient
from app.services.steam_client import SteamClient, SteamOwnedGame


def _configure_steam(monkeypatch, test_user, db_session, steam_id_64="76561197960287930"):
    test_user.steam_id_64 = steam_id_64
    db_session.commit()
    monkeypatch.setattr(get_settings(), "steam_api_key", "test-steam-key")
    monkeypatch.setattr(steam_jobs, "_PACE_DELAY_SECONDS", 0)


def _seed_game(db_session, igdb_id: int, name: str) -> Game:
    game = Game(igdb_id=igdb_id, name=name, slug=name.lower().replace(" ", "-"), category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    return game


def test_run_requires_steam_configuration(db_session, test_user, monkeypatch):
    monkeypatch.setattr(steam_jobs, "_PACE_DELAY_SECONDS", 0)
    # Neither steam_api_key nor test_user.steam_id_64 is set.

    with pytest.raises(steam_jobs.SteamNotConfiguredError):
        steam_jobs.run(lambda: db_session)


def test_run_raises_on_a_private_profile(db_session, test_user, monkeypatch):
    _configure_steam(monkeypatch, test_user, db_session)

    async def fake_get_owned_games(self, steam_id_64):
        return None

    monkeypatch.setattr(SteamClient, "get_owned_games", fake_get_owned_games)

    with pytest.raises(steam_jobs.SteamProfilePrivateError):
        steam_jobs.run(lambda: db_session)


def test_run_never_writes_progress_for_an_already_owned_game(db_session, test_user, seed_platform, monkeypatch):
    # Import is fetch + cache + match only — applying Steam's data to VGT is always a
    # separate, explicit action (steam_service.sync_entries), never automatic.
    game = _seed_game(db_session, igdb_id=233, name="Half-Life 2")
    game_id = game.id  # captured before run() below closes db_session
    db_session.add(LibraryItem(game_id=game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()
    _configure_steam(monkeypatch, test_user, db_session)

    async def fake_get_owned_games(self, steam_id_64):
        return [
            SteamOwnedGame(
                app_id=220, name="Half-Life 2", playtime_minutes=754, last_played_at=datetime(2026, 1, 1, tzinfo=UTC)
            )
        ]

    async def fake_get_igdb_id(self, steam_app_id):
        assert steam_app_id == 220
        return 233

    monkeypatch.setattr(SteamClient, "get_owned_games", fake_get_owned_games)
    monkeypatch.setattr(IGDBClient, "get_igdb_id_for_steam_appid", fake_get_igdb_id)

    result = steam_jobs.run(lambda: db_session)

    assert result == {"total": 1, "succeeded": 1, "failed": 0, "failures": []}
    assert game_progress_repository.get_progress(db_session, game_id) is None
    entry = steam_repository.get_entry(db_session, 220)
    assert entry.game_id == game_id
    assert entry.steam_playtime_minutes == 754  # the cache still updates, just not GameProgress


def test_run_caches_the_match_for_an_untracked_game(db_session, test_user, monkeypatch):
    game = _seed_game(db_session, igdb_id=233, name="Half-Life 2")
    game_id = game.id  # captured before run() below closes db_session
    _configure_steam(monkeypatch, test_user, db_session)

    async def fake_get_owned_games(self, steam_id_64):
        return [SteamOwnedGame(app_id=220, name="Half-Life 2", playtime_minutes=754, last_played_at=None)]

    async def fake_get_igdb_id(self, steam_app_id):
        return 233

    monkeypatch.setattr(SteamClient, "get_owned_games", fake_get_owned_games)
    monkeypatch.setattr(IGDBClient, "get_igdb_id_for_steam_appid", fake_get_igdb_id)

    result = steam_jobs.run(lambda: db_session)

    assert result["succeeded"] == 1
    assert game_progress_repository.get_progress(db_session, game_id) is None
    entry = steam_repository.get_entry(db_session, 220)
    assert entry.game_id == game_id  # matched and cached, ready for the Steam Sync page


def test_run_isolates_a_per_game_failure(db_session, test_user, monkeypatch):
    _configure_steam(monkeypatch, test_user, db_session)

    async def fake_get_owned_games(self, steam_id_64):
        return [
            SteamOwnedGame(app_id=1, name="Good Game", playtime_minutes=10, last_played_at=None),
            SteamOwnedGame(app_id=2, name="Bad Game", playtime_minutes=20, last_played_at=None),
        ]

    async def fake_get_igdb_id(self, steam_app_id):
        if steam_app_id == 2:
            raise RuntimeError("IGDB request failed")
        return None  # unmatched is fine for "Good Game" — just proves it isn't skipped

    monkeypatch.setattr(SteamClient, "get_owned_games", fake_get_owned_games)
    monkeypatch.setattr(IGDBClient, "get_igdb_id_for_steam_appid", fake_get_igdb_id)

    result = steam_jobs.run(lambda: db_session)

    assert result["total"] == 2
    assert result["succeeded"] == 1
    assert result["failed"] == 1
    assert result["failures"] == [{"gameId": 2, "gameName": "Bad Game", "error": "IGDB request failed"}]
    assert steam_repository.get_entry(db_session, 1) is not None  # good game still cached


def test_run_skips_matching_for_an_ignored_entry(db_session, test_user, monkeypatch):
    db_session.add(SteamLibraryEntry(steam_app_id=220, steam_name="Half-Life 2", dismissed=True))
    db_session.commit()
    _configure_steam(monkeypatch, test_user, db_session)

    match_calls = []

    async def fake_get_owned_games(self, steam_id_64):
        return [SteamOwnedGame(app_id=220, name="Half-Life 2", playtime_minutes=754, last_played_at=None)]

    async def fake_get_igdb_id(self, steam_app_id):
        match_calls.append(steam_app_id)
        return 233

    monkeypatch.setattr(SteamClient, "get_owned_games", fake_get_owned_games)
    monkeypatch.setattr(IGDBClient, "get_igdb_id_for_steam_appid", fake_get_igdb_id)

    steam_jobs.run(lambda: db_session)

    assert match_calls == []  # an ignored entry is never re-matched
