import pytest

from app.models.catalog import Game, GameCategory
from app.models.gog import GogLibraryEntry, GogWishlistEntry
from app.models.library import LibraryItem
from app.models.system import User
from app.services import game_service, gog_jobs
from app.services.gog_client import GogAuthError, GogClient, GogNotConnectedError, GogOwnedGame
from app.services.igdb_client import IGDBClient


def _connect(db_session, test_user, token="refresh-1"):
    test_user.gog_refresh_token = token
    db_session.commit()


def _seed_game(db_session, igdb_id: int, name: str) -> Game:
    game = Game(igdb_id=igdb_id, name=name, slug=name.lower().replace(" ", "-"), category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    return game


def _fake_library(monkeypatch, games, rotated_token="refresh-2", wishlist=None, titles=None):
    async def fake_get_owned_library(self):
        self._refresh_token = rotated_token
        return games

    # Every test gets an empty wishlist by default, so nothing ever calls GOG for real.
    async def fake_get_wishlist_ids(self):
        return list(wishlist or [])

    async def fake_get_product_titles(self, product_ids):
        return {product_id: name for product_id, name in (titles or {}).items() if product_id in product_ids}

    monkeypatch.setattr(GogClient, "get_owned_library", fake_get_owned_library)
    monkeypatch.setattr(GogClient, "get_wishlist_ids", fake_get_wishlist_ids)
    monkeypatch.setattr(GogClient, "get_product_titles", fake_get_product_titles)


def _fake_igdb(monkeypatch, mapping, calls=None):
    async def fake_lookup(self, product_ids):
        if calls is not None:
            calls.append(list(product_ids))
        return {product_id: mapping[product_id] for product_id in product_ids if product_id in mapping}

    monkeypatch.setattr(IGDBClient, "get_igdb_ids_for_gog_products", fake_lookup)


@pytest.fixture(autouse=True)
def _no_pacing(monkeypatch):
    monkeypatch.setattr(gog_jobs, "_PACE_DELAY_SECONDS", 0)


def test_run_requires_a_connected_account(db_session, test_user):
    with pytest.raises(GogNotConnectedError):
        gog_jobs.run(lambda: db_session)


def test_run_caches_matches_existing_games_and_never_adds_library_items(db_session, test_user, monkeypatch):
    game = _seed_game(db_session, igdb_id=1942, name="The Witcher 3")
    game_id = game.id
    _connect(db_session, test_user)
    _fake_library(monkeypatch, [GogOwnedGame(1207664663, "The Witcher 3"), GogOwnedGame(5, "Obscure Thing")])
    _fake_igdb(monkeypatch, {1207664663: 1942})

    result = gog_jobs.run(lambda: db_session)

    assert {key: result[key] for key in ("total", "succeeded", "failed", "failures")} == {
        "total": 2,
        "succeeded": 2,
        "failed": 0,
        "failures": [],
    }
    assert result["wishlist"]["total"] == 0
    entries = {entry.gog_product_id: entry for entry in db_session.query(GogLibraryEntry).all()}
    assert entries[1207664663].game_id == game_id
    assert entries[5].game_id is None
    assert db_session.query(LibraryItem).count() == 0


def test_run_saves_the_rotated_refresh_token(db_session, test_user, monkeypatch):
    _connect(db_session, test_user)
    _fake_library(monkeypatch, [], rotated_token="refresh-2")
    _fake_igdb(monkeypatch, {})

    gog_jobs.run(lambda: db_session)

    assert db_session.query(User).first().gog_refresh_token == "refresh-2"


def test_run_saves_the_rotated_token_even_when_matching_fails(db_session, test_user, monkeypatch):
    _connect(db_session, test_user)
    _fake_library(monkeypatch, [GogOwnedGame(1, "A")], rotated_token="refresh-2")

    async def broken_lookup(self, product_ids):
        raise RuntimeError("IGDB is down")

    monkeypatch.setattr(IGDBClient, "get_igdb_ids_for_gog_products", broken_lookup)

    result = gog_jobs.run(lambda: db_session)

    assert result["failed"] == 1
    assert result["succeeded"] == 0
    assert result["failures"][0]["error"] == "IGDB is down"
    assert db_session.query(User).first().gog_refresh_token == "refresh-2"


def test_run_only_looks_up_unmatched_entries_that_are_not_ignored(db_session, test_user, monkeypatch):
    game = _seed_game(db_session, igdb_id=10, name="Linked")
    db_session.add_all(
        [
            GogLibraryEntry(gog_product_id=1, gog_name="Linked", game_id=game.id),
            GogLibraryEntry(gog_product_id=2, gog_name="Ignored", dismissed=True),
        ]
    )
    db_session.commit()
    _connect(db_session, test_user)
    _fake_library(monkeypatch, [GogOwnedGame(1, "Linked"), GogOwnedGame(2, "Ignored"), GogOwnedGame(3, "Fresh")])
    calls: list[list[int]] = []
    _fake_igdb(monkeypatch, {}, calls)

    gog_jobs.run(lambda: db_session)

    assert calls == [[3]]


def test_run_batches_lookups(db_session, test_user, monkeypatch):
    monkeypatch.setattr(gog_jobs, "GOG_LOOKUP_BATCH_SIZE", 2)
    _connect(db_session, test_user)
    _fake_library(monkeypatch, [GogOwnedGame(product_id, f"Game {product_id}") for product_id in range(1, 6)])
    calls: list[list[int]] = []
    _fake_igdb(monkeypatch, {}, calls)

    result = gog_jobs.run(lambda: db_session)

    assert calls == [[1, 2], [3, 4], [5]]
    assert result["total"] == 5


def test_run_imports_a_game_vgt_does_not_have_yet(db_session, test_user, monkeypatch):
    _connect(db_session, test_user)
    _fake_library(monkeypatch, [GogOwnedGame(7, "New To VGT")])
    _fake_igdb(monkeypatch, {7: 777})

    async def fake_import(db, igdb_client, igdb_id):
        game = _seed_game(db, igdb_id=igdb_id, name="New To VGT")
        return type("GameWithStatus", (), {"game": game})()

    monkeypatch.setattr(game_service, "import_game_from_igdb", fake_import)

    gog_jobs.run(lambda: db_session)

    entry = db_session.query(GogLibraryEntry).filter_by(gog_product_id=7).one()
    assert entry.game is not None
    assert entry.game.igdb_id == 777


def test_run_keeps_entries_gog_no_longer_returns(db_session, test_user, monkeypatch):
    db_session.add(GogLibraryEntry(gog_product_id=99, gog_name="Gone From Response", dismissed=True))
    db_session.commit()
    _connect(db_session, test_user)
    _fake_library(monkeypatch, [])
    _fake_igdb(monkeypatch, {})

    gog_jobs.run(lambda: db_session)

    assert db_session.query(GogLibraryEntry).filter_by(gog_product_id=99).count() == 1


def test_run_surfaces_a_revoked_login(db_session, test_user, monkeypatch):
    _connect(db_session, test_user)

    async def revoked(self):
        raise GogAuthError("GOG rejected the saved login")

    monkeypatch.setattr(GogClient, "get_owned_library", revoked)

    with pytest.raises(GogAuthError):
        gog_jobs.run(lambda: db_session)


# --- wishlist ----------------------------------------------------------------------------


def test_run_caches_and_matches_the_wishlist_with_names_from_gog(db_session, test_user, monkeypatch):
    game = _seed_game(db_session, igdb_id=55, name="Cyberpunk 2077")
    game_id = game.id
    _connect(db_session, test_user)
    _fake_library(monkeypatch, [], wishlist=[1423049311, 8], titles={1423049311: "Cyberpunk 2077"})
    _fake_igdb(monkeypatch, {1423049311: 55})

    result = gog_jobs.run(lambda: db_session)

    assert result["wishlist"]["total"] == 2
    assert result["wishlist"]["failed"] == 0
    rows = {row.gog_product_id: row for row in db_session.query(GogWishlistEntry).all()}
    assert rows[1423049311].gog_name == "Cyberpunk 2077"
    assert rows[1423049311].game_id == game_id
    assert rows[8].gog_name == "GOG product 8"
    assert rows[8].game_id is None
    assert db_session.query(LibraryItem).count() == 0


def test_a_wishlist_failure_keeps_the_owned_results(db_session, test_user, monkeypatch):
    _connect(db_session, test_user)
    _fake_library(monkeypatch, [GogOwnedGame(1, "Owned Game")])
    _fake_igdb(monkeypatch, {})

    async def broken_wishlist(self):
        raise RuntimeError("wishlist unavailable")

    monkeypatch.setattr(GogClient, "get_wishlist_ids", broken_wishlist)

    result = gog_jobs.run(lambda: db_session)

    assert result["total"] == 1
    assert result["wishlist"]["error"] == "wishlist unavailable"
    assert db_session.query(GogLibraryEntry).count() == 1


def test_a_failed_name_lookup_keeps_the_placeholder_and_still_matches(db_session, test_user, monkeypatch):
    _seed_game(db_session, igdb_id=77, name="Matched By Id")
    _connect(db_session, test_user)
    _fake_library(monkeypatch, [], wishlist=[9])
    _fake_igdb(monkeypatch, {9: 77})

    async def broken_titles(self, product_ids):
        raise RuntimeError("catalog down")

    monkeypatch.setattr(GogClient, "get_product_titles", broken_titles)

    gog_jobs.run(lambda: db_session)

    row = db_session.query(GogWishlistEntry).one()
    assert row.gog_name == "GOG product 9"
    assert row.game is not None


def test_a_known_wishlist_name_is_not_looked_up_again(db_session, test_user, monkeypatch):
    db_session.add(GogWishlistEntry(gog_product_id=9, gog_name="Already Named"))
    db_session.commit()
    _connect(db_session, test_user)
    _fake_library(monkeypatch, [], wishlist=[9])
    _fake_igdb(monkeypatch, {})
    asked: list[list[int]] = []

    async def spy_titles(self, product_ids):
        asked.append(list(product_ids))
        return {}

    monkeypatch.setattr(GogClient, "get_product_titles", spy_titles)

    gog_jobs.run(lambda: db_session)

    assert asked == []
    assert db_session.query(GogWishlistEntry).one().gog_name == "Already Named"
