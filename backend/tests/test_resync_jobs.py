from app.models.catalog import Game, GameCategory
from app.services import game_service, resync_jobs


def _seed_games(db_session, count: int) -> list[Game]:
    games = [
        Game(igdb_id=2000 + i, name=f"Resync Test Game {i}", slug=f"resync-test-game-{i}", category=GameCategory.MAIN_GAME)
        for i in range(count)
    ]
    db_session.add_all(games)
    db_session.commit()
    return games


def test_run_isolates_a_per_game_failure_and_attempts_every_game(db_session, monkeypatch):
    games = _seed_games(db_session, 3)
    failing_id = games[1].id
    failing_name = games[1].name  # captured before run() closes db_session below

    async def fake_resync_game(db, igdb_client, game_id, scope=None):
        if game_id == failing_id:
            raise RuntimeError("IGDB game not found")
        return None

    monkeypatch.setattr(game_service, "resync_game", fake_resync_game)
    monkeypatch.setattr(resync_jobs, "_PACE_DELAY_SECONDS", 0)

    # Any one of the four DEFINITION_* jobs exercises the same shared isolation/pacing/skip
    # logic in _resync_all — the scope itself only affects what game_service.resync_game
    # (mocked here) writes, which is covered separately in test_catalog_richness.py.
    result = resync_jobs.DEFINITION_ALL.run(lambda: db_session)

    assert result["total"] == 3
    assert result["succeeded"] == 2
    assert result["failed"] == 1
    assert result["failures"] == [{"game_id": failing_id, "game_name": failing_name, "error": "IGDB game not found"}]


def test_run_skips_manually_added_games(db_session, monkeypatch):
    manual_game = Game(name="Manually Added Game", category=GameCategory.MAIN_GAME)
    db_session.add(manual_game)
    db_session.commit()

    calls = []

    async def fake_resync_game(db, igdb_client, game_id, scope=None):
        calls.append(game_id)
        return None

    monkeypatch.setattr(game_service, "resync_game", fake_resync_game)
    monkeypatch.setattr(resync_jobs, "_PACE_DELAY_SECONDS", 0)

    result = resync_jobs.DEFINITION_ALL.run(lambda: db_session)

    assert result["total"] == 0
    assert calls == []
