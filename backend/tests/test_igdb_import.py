from datetime import UTC, datetime

import pytest

from app.models.catalog import Game, GameCategory
from app.models.igdb_import import IgdbImportEntry
from app.models.library import LibraryItem, LibraryStatus, Note
from app.services import igdb_import_jobs, igdb_import_service, job_registry
from app.services.igdb_client import IGDBClient
from app.services.igdb_import_service import normalize_name, pick_match


def _ts(year: int) -> int:
    return int(datetime(year, 6, 1, tzinfo=UTC).timestamp())


def _igdb(igdb_id: int, name: str, game_type: int = 0, year: int | None = None, parent: int | None = None) -> dict:
    result = {"id": igdb_id, "name": name, "game_type": game_type, "cover_url": f"https://igdb.example/{igdb_id}.jpg"}
    if year is not None:
        result["first_release_date"] = _ts(year)
    if parent is not None:
        result["parent_game"] = {"id": parent, "name": "Parent"}
    return result


def _custom(db_session, name: str, **fields) -> Game:
    game = Game(name=name, category=fields.pop("category", GameCategory.MAIN_GAME), **fields)
    db_session.add(game)
    db_session.commit()
    return game


@pytest.fixture()
def no_pacing(monkeypatch):
    monkeypatch.setattr(igdb_import_jobs, "_PACE_DELAY_SECONDS", 0)


def test_normalize_name_ignores_case_accents_and_symbols():
    for variant in ("Stage Tour", "stage tour", "Stage Tour™", "Stage Tour!", "  STAGE   tour "):
        assert normalize_name(variant) == "stage tour"
    assert normalize_name("Pokémon: Red & Blue") == normalize_name("Pokemon Red and Blue")
    assert normalize_name("Stage Tour 2") != normalize_name("Stage Tour")


def test_pick_match_takes_the_one_exact_name_match_of_a_linkable_kind():
    game = Game(name="Stage Tour", category=GameCategory.MAIN_GAME)
    candidates = [
        _igdb(1, "Stage Tour: Deluxe"),
        _igdb(2, "Stage Tour"),
        _igdb(3, "Stage Tour", game_type=1),  # a DLC can't be a game's match
    ]

    match, count = pick_match(game, candidates)

    assert (match["id"], count) == (2, 1)


def test_pick_match_uses_the_release_year_to_choose_between_same_named_games():
    candidates = [_igdb(10, "Doom", year=1993), _igdb(11, "Doom", year=2016)]

    assert (
        pick_match(Game(name="Doom", category=GameCategory.MAIN_GAME, first_release_date=_ts(2016)), candidates)[0][
            "id"
        ]
        == 11
    )
    # Without a year (or with one that doesn't narrow it to one), it's for the user to pick.
    assert pick_match(Game(name="Doom", category=GameCategory.MAIN_GAME), candidates) == (None, 2)
    assert pick_match(Game(name="Doom", category=GameCategory.MAIN_GAME, first_release_date=_ts(2005)), candidates) == (
        None,
        2,
    )
    assert pick_match(Game(name="Doom", category=GameCategory.MAIN_GAME), []) == (None, 0)


def test_pick_match_matches_an_addon_among_addons():
    addon = Game(name="Extra Songs", category=GameCategory.DLC_ADDON)

    match, _count = pick_match(addon, [_igdb(20, "Extra Songs", game_type=0), _igdb(21, "Extra Songs", game_type=1)])

    assert match["id"] == 21


def test_list_entries_has_every_custom_game_and_nothing_else(auth_client, db_session, seed_game):
    _custom(db_session, "Homebrew")
    _custom(db_session, "Found By A Resync", auto_discovered=True)

    response = auth_client.get("/api/igdb-import/entries")

    assert response.status_code == 200
    [row] = response.json()
    assert (row["gameName"], row["status"], row["matchIgdbId"]) == ("Homebrew", "not_checked", None)


def test_find_matches_job_records_each_status(auth_client, db_session, seed_game, monkeypatch, no_pacing):
    _custom(db_session, "Stage Tour")
    _custom(db_session, "Doom")
    _custom(db_session, "Nothing Like It")
    _custom(db_session, "Test Game")  # its match is the seed game, already in the library
    ignored = _custom(db_session, "Ignored One")
    db_session.add(IgdbImportEntry(game_id=ignored.id, dismissed=True, exact_match_count=0))
    db_session.commit()
    searched: list[str] = []

    async def fake_search(self, query, limit=25, category_scope="game"):
        searched.append(query)
        return {
            "Stage Tour": [_igdb(393269, "Stage Tour")],
            "Doom": [_igdb(10, "Doom", year=1993), _igdb(11, "Doom", year=2016)],
            "Test Game": [_igdb(seed_game.igdb_id, "Test Game")],
        }.get(query, [_igdb(99, "Something Else")])

    monkeypatch.setattr(IGDBClient, "search_games", fake_search)

    result = igdb_import_jobs.run_match(lambda: db_session)

    assert (result["total"], result["succeeded"], result["failed"]) == (4, 4, 0)
    assert "Ignored One" not in searched
    rows = {row["gameName"]: row for row in auth_client.get("/api/igdb-import/entries").json()}
    assert rows["Stage Tour"]["status"] == "match_found"
    assert rows["Stage Tour"]["matchIgdbId"] == 393269
    assert (rows["Doom"]["status"], rows["Doom"]["exactMatchCount"]) == ("several_matches", 2)
    assert rows["Nothing Like It"]["status"] == "no_match"
    assert rows["Test Game"]["status"] == "in_library"
    assert rows["Test Game"]["libraryGameName"] == "Test Game"
    assert rows["Ignored One"]["status"] == "ignored"


def _matched(db_session, game: Game, igdb_id: int, **fields) -> None:
    db_session.add(
        IgdbImportEntry(
            game_id=game.id,
            match_igdb_id=igdb_id,
            match_name=fields.pop("name", game.name),
            match_category=fields.pop("category", GameCategory.MAIN_GAME),
            exact_match_count=1,
            checked_at=datetime.now(UTC),
            **fields,
        )
    )
    db_session.commit()


@pytest.fixture()
def fake_igdb_import(monkeypatch):
    """IGDB's side of importing a game: returns a minimal payload for any id, no addons."""

    async def fake_get_games_by_ids(self, ids):
        return [{"id": igdb_id, "name": f"IGDB {igdb_id}", "game_type": 0} for igdb_id in ids]

    async def fake_get_addons(self, parent_igdb_id):
        return []

    monkeypatch.setattr(IGDBClient, "get_games_by_ids", fake_get_games_by_ids)
    monkeypatch.setattr(IGDBClient, "get_addons_by_parent_igdb_id", fake_get_addons)


def test_link_one_links_in_place_and_leaves_the_page(auth_client, db_session, igdb_client, fake_igdb_import):
    game = _custom(db_session, "Stage Tour")
    game_id = game.id
    _matched(db_session, game, 393269)

    response = auth_client.post(f"/api/igdb-import/{game_id}/link")

    assert response.status_code == 200
    db_session.expire_all()
    linked = db_session.get(Game, game_id)
    assert (linked.igdb_id, linked.linked_from_custom) == (393269, True)
    assert db_session.query(IgdbImportEntry).filter_by(game_id=game_id).count() == 0
    assert auth_client.get("/api/igdb-import/entries").json() == []


def test_link_one_merges_into_a_match_already_in_the_library(
    auth_client, db_session, igdb_client, seed_game, seed_platform
):
    game = _custom(db_session, "Test Game")
    game_id = game.id
    db_session.add(LibraryItem(game_id=game_id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.add(Note(game_id=game_id, body="from the custom entry"))
    _matched(db_session, game, seed_game.igdb_id)

    response = auth_client.post(f"/api/igdb-import/{game_id}/link")

    assert response.status_code == 200
    db_session.expire_all()
    assert db_session.get(Game, game_id) is None
    assert db_session.query(Note).filter_by(game_id=seed_game.id).one().body == "from the custom entry"
    assert db_session.query(IgdbImportEntry).count() == 0


def test_link_one_refuses_a_game_without_a_single_match(auth_client, db_session, igdb_client):
    unchecked = _custom(db_session, "Unchecked")
    several = _custom(db_session, "Doom")
    db_session.add(IgdbImportEntry(game_id=several.id, exact_match_count=2, checked_at=datetime.now(UTC)))
    db_session.commit()

    assert auth_client.post(f"/api/igdb-import/{unchecked.id}/link").status_code == 409
    assert auth_client.post(f"/api/igdb-import/{several.id}/link").status_code == 409
    assert auth_client.post("/api/igdb-import/999999/link").status_code == 404


def test_ignore_and_unignore(auth_client, db_session):
    game = _custom(db_session, "Homebrew")

    response = auth_client.post("/api/igdb-import/ignore", json={"gameIds": [game.id], "ignored": True})
    assert response.json() == {"count": 1}
    assert auth_client.get("/api/igdb-import/entries").json()[0]["status"] == "ignored"

    auth_client.post("/api/igdb-import/ignore", json={"gameIds": [game.id], "ignored": False})
    assert auth_client.get("/api/igdb-import/entries").json()[0]["status"] == "not_checked"


def test_link_selected_queues_only_linkable_games_and_the_job_links_them(
    auth_client, db_session, monkeypatch, fake_igdb_import, no_pacing
):
    good = _custom(db_session, "Stage Tour")
    _matched(db_session, good, 393269)
    other = _custom(db_session, "Another")
    _matched(db_session, other, 393270)
    no_match = _custom(db_session, "Nothing")
    db_session.add(IgdbImportEntry(game_id=no_match.id, exact_match_count=0, checked_at=datetime.now(UTC)))
    db_session.commit()
    good_id, other_id, no_match_id = good.id, other.id, no_match.id
    started: list[str] = []
    monkeypatch.setattr(job_registry, "trigger_run", lambda job_id, session_factory: started.append(job_id))

    response = auth_client.post("/api/igdb-import/link", json={"gameIds": [good_id, other_id, no_match_id]})

    assert response.status_code == 202
    assert response.json() == {"count": 2}
    assert started == [igdb_import_jobs.JOB_IGDB_LINK]

    result = igdb_import_jobs.run_link(lambda: db_session)

    assert (result["total"], result["succeeded"], result["failed"]) == (2, 2, 0)
    db_session.expire_all()
    assert db_session.get(Game, good_id).igdb_id == 393269
    assert db_session.get(Game, other_id).igdb_id == 393270
    assert db_session.get(Game, no_match_id).igdb_id is None


def test_the_link_job_reports_a_failure_and_carries_on(db_session, monkeypatch, fake_igdb_import, no_pacing):
    bad = _custom(db_session, "Bad")
    _matched(db_session, bad, 500, queued=True)
    good = _custom(db_session, "Good")
    _matched(db_session, good, 501, queued=True)
    bad_id, good_id = bad.id, good.id
    real_link = igdb_import_service.link_entry

    async def flaky_link(db, igdb_client, game_id):
        if game_id == bad_id:
            raise RuntimeError("IGDB timed out")
        return await real_link(db, igdb_client, game_id)

    monkeypatch.setattr(igdb_import_service, "link_entry", flaky_link)

    result = igdb_import_jobs.run_link(lambda: db_session)

    assert (result["succeeded"], result["failed"]) == (1, 1)
    assert result["failures"][0]["gameName"] == "Bad"
    db_session.expire_all()
    assert db_session.get(Game, good_id).igdb_id == 501
    # Still on the page, no longer queued, for another try.
    assert db_session.query(IgdbImportEntry).filter_by(game_id=bad_id).one().queued is False


def test_the_link_job_is_not_listed_under_settings_jobs(auth_client):
    ids = [job["id"] for job in auth_client.get("/api/jobs").json()]
    assert igdb_import_jobs.JOB_IGDB_MATCH in ids
    assert igdb_import_jobs.JOB_IGDB_LINK not in ids


def test_deleting_a_custom_game_removes_its_entry(auth_client, db_session):
    game = _custom(db_session, "Homebrew")
    game_id = game.id
    _matched(db_session, game, 777)

    assert auth_client.delete(f"/api/games/{game_id}").status_code == 204
    db_session.expire_all()
    assert db_session.query(IgdbImportEntry).filter_by(game_id=game_id).count() == 0
