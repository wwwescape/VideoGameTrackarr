"""The Screensaver lab: GET /api/games/screensaver (a random sample of owned games' covers) and
the per-game and bulk opt-outs, all 404 while the lab is off."""

import pytest

from app.models.catalog import Game, GameCategory, Platform
from app.models.labs import LabFeature
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.services import screensaver_service
from tests.test_backup_routes import _upload_backup, _wait_for_restore_completion

COVER = "https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg"


@pytest.fixture()
def screensaver_lab(db_session):
    db_session.add(LabFeature(id="screensaver", enabled=True))
    db_session.commit()


@pytest.fixture()
def platform(db_session):
    row = Platform(name="PlayStation 5", slug="ps5", igdb_id=167)
    db_session.add(row)
    db_session.commit()
    return row


def _game(db_session, name: str, *, cover_url: str | None = COVER, **fields) -> Game:
    game = Game(name=name, cover_url=cover_url, category=fields.pop("category", GameCategory.MAIN_GAME), **fields)
    db_session.add(game)
    db_session.flush()
    return game


def _own(db_session, game: Game, platform: Platform | None, *, status=LibraryStatus.OWNED, fmt=MediaFormat.DIGITAL):
    db_session.add(
        LibraryItem(game_id=game.id, platform_id=platform.id if platform else None, status=status, format=fmt)
    )
    db_session.commit()


def _names(client) -> list[str]:
    response = client.get("/api/games/screensaver")
    assert response.status_code == 200, response.text
    return sorted(game["name"] for game in response.json()["games"])


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("get", "/api/games/screensaver", None),
        ("post", "/api/games/screensaver/bulk", {"gameIds": [1], "excluded": True}),
        ("put", "/api/games/1/screensaver", {"excluded": True}),
    ],
)
def test_routes_are_404_while_the_lab_is_off(auth_client, seed_game, method, path, body):
    kwargs = {"json": body} if body else {}
    assert getattr(auth_client, method)(path, **kwargs).status_code == 404


def test_routes_require_auth(client, screensaver_lab):
    assert client.get("/api/games/screensaver").status_code == 401
    assert client.put("/api/games/1/screensaver", json={"excluded": True}).status_code == 401
    assert client.post("/api/games/screensaver/bulk", json={"gameIds": [1], "excluded": True}).status_code == 401


def test_slide_shape(auth_client, db_session, screensaver_lab, platform):
    game = _game(db_session, "Astro Bot", slug="astro-bot")
    _own(db_session, game, platform)

    body = auth_client.get("/api/games/screensaver").json()

    assert body == {
        "games": [{"id": game.id, "uuid": game.uuid, "slug": "astro-bot", "name": "Astro Bot", "coverUrl": COVER}],
        "total": 1,
    }


def test_only_owned_top_level_games_with_a_cover(auth_client, db_session, screensaver_lab, platform):
    _own(db_session, _game(db_session, "Digital"), platform)
    _own(db_session, _game(db_session, "Physical"), platform, fmt=MediaFormat.PHYSICAL)
    _own(db_session, _game(db_session, "No Platform"), None, fmt=None)
    _own(db_session, _game(db_session, "Uncategorized", category=None), platform)
    _own(db_session, _game(db_session, "Wished"), platform, status=LibraryStatus.WISHLIST)
    _own(db_session, _game(db_session, "No Cover", cover_url=None), platform)
    _own(db_session, _game(db_session, "Empty Cover", cover_url=""), platform)
    _own(db_session, _game(db_session, "Opted Out", screensaver_excluded=True), platform)
    base = _game(db_session, "Base")
    _own(db_session, base, platform)
    _own(db_session, _game(db_session, "DLC", category=GameCategory.DLC_ADDON, parent_game_id=base.id), platform)
    # A Missing game (found by a Collection resync, never added) isn't owned, so it's out too.
    _game(db_session, "Missing", auto_discovered=True)
    _game(db_session, "Not Owned")
    db_session.commit()

    assert _names(auth_client) == ["Base", "Digital", "No Platform", "Physical", "Uncategorized"]


def test_sample_is_capped_and_total_counts_them_all(db_session, platform):
    for index in range(12):
        _own(db_session, _game(db_session, f"Game {index:02}"), platform)

    sample = screensaver_service.sample(db_session, limit=5)

    assert len(sample.games) == 5
    assert len({game.id for game in sample.games}) == 5
    assert sample.total == 12


def test_sample_order_is_random(db_session, platform):
    for index in range(30):
        _own(db_session, _game(db_session, f"Game {index:02}"), platform)

    orders = {tuple(game.id for game in screensaver_service.sample(db_session).games) for _ in range(5)}

    # Five identical orders of 30 games by chance is about 1 in 10^128.
    assert len(orders) > 1


def test_opting_a_game_out_and_back_in(auth_client, db_session, screensaver_lab, platform):
    game = _game(db_session, "Astro Bot")
    _own(db_session, game, platform)

    response = auth_client.put(f"/api/games/{game.id}/screensaver", json={"excluded": True})
    assert response.status_code == 200
    assert response.json() == {"id": game.id, "excluded": True}
    assert auth_client.get(f"/api/games/{game.uuid}").json()["screensaverExcluded"] is True
    assert _names(auth_client) == []

    auth_client.put(f"/api/games/{game.id}/screensaver", json={"excluded": False})
    assert auth_client.get(f"/api/games/{game.uuid}").json()["screensaverExcluded"] is False
    assert _names(auth_client) == ["Astro Bot"]


def test_opting_out_an_unknown_game_is_404(auth_client, screensaver_lab):
    assert auth_client.put("/api/games/999/screensaver", json={"excluded": True}).status_code == 404


def test_bulk_opt_out_skips_unknown_ids(auth_client, db_session, screensaver_lab, platform):
    games = [_game(db_session, name) for name in ("One", "Two", "Three")]
    for game in games:
        _own(db_session, game, platform)

    response = auth_client.post(
        "/api/games/screensaver/bulk",
        json={"gameIds": [games[0].id, games[1].id, games[1].id, 999], "excluded": True},
    )

    assert response.status_code == 200
    assert response.json() == {"updated": 2}
    assert _names(auth_client) == ["Three"]

    auth_client.post("/api/games/screensaver/bulk", json={"gameIds": [games[0].id], "excluded": False})
    assert _names(auth_client) == ["One", "Three"]


def test_bulk_needs_at_least_one_id(auth_client, screensaver_lab):
    assert auth_client.post("/api/games/screensaver/bulk", json={"gameIds": [], "excluded": True}).status_code == 422


def test_opt_outs_are_kept_while_the_lab_is_off(auth_client, db_session, screensaver_lab, platform):
    game = _game(db_session, "Astro Bot")
    _own(db_session, game, platform)
    auth_client.put(f"/api/games/{game.id}/screensaver", json={"excluded": True})

    auth_client.put("/api/labs/screensaver", json={"enabled": False})
    auth_client.put("/api/labs/screensaver", json={"enabled": True})

    assert _names(auth_client) == []


def test_the_share_page_is_not_told_about_the_screensaver(auth_client, screensaver_lab):
    token = auth_client.post("/api/share-link").json()["token"]
    assert auth_client.get(f"/api/public/{token}/labs").json() == {"enabled": []}


def test_a_backup_carries_opt_outs(auth_client, db_session, screensaver_lab, platform):
    kept = _game(db_session, "Kept")
    hidden = _game(db_session, "Hidden", screensaver_excluded=True)
    _own(db_session, kept, platform)
    _own(db_session, hidden, platform)
    backup = auth_client.get("/api/export/backup").json()
    assert {game["name"]: game["screensaver_excluded"] for game in backup["games"]} == {"Kept": False, "Hidden": True}

    assert _upload_backup(auth_client, backup).status_code == 202
    assert _wait_for_restore_completion(auth_client)["status"] == "completed"
    db_session.expire_all()

    assert {game.name: game.screensaver_excluded for game in db_session.query(Game)} == {"Kept": False, "Hidden": True}


def test_a_backup_from_before_the_screensaver_restores_every_game_as_in(auth_client, db_session, screensaver_lab):
    payload = {
        "version": 6,
        "exported_at": "2026-11-01T00:00:00+00:00",
        "platforms": [],
        "regions": [],
        "tags": [],
        "games": [{"id": 100, "name": "Old Game", "category": "main_game"}],
        "library_items": [],
        "game_progress": [],
        "play_sessions": [],
        "notes": [],
        "game_tags": [],
    }

    assert _upload_backup(auth_client, payload).status_code == 202
    assert _wait_for_restore_completion(auth_client)["status"] == "completed"
    db_session.expire_all()

    assert db_session.get(Game, 100).screensaver_excluded is False


def test_time_per_cover_defaults_to_null(auth_client):
    assert auth_client.get("/api/auth/me").json()["screensaverIntervalSeconds"] is None


@pytest.mark.parametrize("seconds", [5, 12, 15])
def test_time_per_cover_is_saved(auth_client, seconds):
    response = auth_client.put("/api/auth/me/preferences", json={"screensaverIntervalSeconds": seconds})

    assert response.status_code == 200
    assert response.json()["screensaverIntervalSeconds"] == seconds
    assert auth_client.get("/api/auth/me").json()["screensaverIntervalSeconds"] == seconds


@pytest.mark.parametrize("seconds", [4, 16, 0])
def test_time_per_cover_is_5_to_15_seconds(auth_client, seconds):
    response = auth_client.put("/api/auth/me/preferences", json={"screensaverIntervalSeconds": seconds})
    assert response.status_code == 422


def test_other_preferences_leave_time_per_cover_alone(auth_client):
    auth_client.put("/api/auth/me/preferences", json={"screensaverIntervalSeconds": 11})
    auth_client.put("/api/auth/me/preferences", json={"currency": "EUR"})
    assert auth_client.get("/api/auth/me").json()["screensaverIntervalSeconds"] == 11


def test_a_backup_carries_time_per_cover(auth_client, db_session):
    auth_client.put("/api/auth/me/preferences", json={"screensaverIntervalSeconds": 13})
    backup = auth_client.get("/api/export/backup").json()
    assert backup["settings"]["screensaver_interval_seconds"] == 13

    auth_client.put("/api/auth/me/preferences", json={"screensaverIntervalSeconds": 6})
    assert _upload_backup(auth_client, backup).status_code == 202
    assert _wait_for_restore_completion(auth_client)["status"] == "completed"
    db_session.expire_all()

    assert auth_client.get("/api/auth/me").json()["screensaverIntervalSeconds"] == 13


def _list(client, **params) -> list[str]:
    response = client.get("/api/games", params=params)
    assert response.status_code == 200, response.text
    return sorted(game["name"] for game in response.json())


def test_the_games_list_carries_each_games_opt_out(auth_client, db_session, platform):
    _own(db_session, _game(db_session, "Shown"), platform)
    _own(db_session, _game(db_session, "Hidden", screensaver_excluded=True), platform)

    games = {game["name"]: game["screensaverExcluded"] for game in auth_client.get("/api/games").json()}

    assert games == {"Shown": False, "Hidden": True}


def test_filtering_the_games_list_by_screensaver(auth_client, db_session, platform):
    other = Platform(name="Nintendo Switch", slug="switch", igdb_id=130)
    db_session.add(other)
    db_session.commit()
    _own(db_session, _game(db_session, "Shown"), platform)
    _own(db_session, _game(db_session, "Hidden PS5", screensaver_excluded=True), platform)
    _own(db_session, _game(db_session, "Hidden Switch", screensaver_excluded=True), other)
    # Filtered on the opt-out alone: a wishlisted or coverless game still counts as shown.
    _own(db_session, _game(db_session, "Wished", cover_url=None), platform, status=LibraryStatus.WISHLIST)

    assert _list(auth_client) == ["Hidden PS5", "Hidden Switch", "Shown", "Wished"]
    assert _list(auth_client, screensaver="hidden") == ["Hidden PS5", "Hidden Switch"]
    assert _list(auth_client, screensaver="shown") == ["Shown", "Wished"]
    assert _list(auth_client, screensaver="hidden", platformId=other.id) == ["Hidden Switch"]


def test_an_unknown_screensaver_filter_is_422(auth_client):
    assert auth_client.get("/api/games", params={"screensaver": "maybe"}).status_code == 422
