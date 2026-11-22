"""Short-name search: library search matches IGDB's alternative names ("gta 6" finds Grand Theft
Auto VI) and ignores punctuation, spaces, case and accents ("gtav" finds "GTA V")."""

import httpx
import respx

from app.core.search_keys import alternative_names_from_igdb, search_key
from app.models.catalog import Game, GameAlternativeName, GameCategory
from app.services import alternative_names_job, backup_service, game_service
from app.services.game_service import CatalogSyncScope
from app.services.igdb_client import GAME_FIELDS, IGDB_API_BASE, IGDB_TOKEN_URL, IGDBClient

TOKEN_RESPONSE = httpx.Response(200, json={"access_token": "test-token", "expires_in": 3600})

GTA_ALTERNATIVE_NAMES = [
    {"id": 1, "name": "GTA 6", "comment": "Acronym"},
    {"id": 2, "name": "GTA6", "comment": "Acronym"},  # same key as "GTA 6": dropped
    {"id": 3, "name": "GTA VI", "comment": "Acronym"},
    {"id": 4, "name": "Grand Theft Auto VI", "comment": "Alternative title"},  # the game's own name: dropped
    {"id": 5, "name": "  ", "comment": "Blank"},  # dropped
    {"id": 6, "name": "Grand Theft Auto 6", "comment": "  "},  # blank comment becomes None
]


def _game(db_session, name: str, igdb_id: int, aliases: list[str] = ()) -> Game:
    game = Game(igdb_id=igdb_id, name=name, category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.flush()
    for alias in aliases:
        db_session.add(GameAlternativeName(game_id=game.id, name=alias, comment="Acronym"))
    db_session.commit()
    return game


def _search(auth_client, text: str) -> list[dict]:
    response = auth_client.get("/api/games", params={"search": text})
    assert response.status_code == 200, response.text
    return response.json()


# --- search keys -------------------------------------------------------------------------


def test_search_key_keeps_only_letters_and_digits():
    assert search_key("GTA V") == "gtav"
    assert search_key("Pokémon: Let's Go, Pikachu!") == "pokemonletsgopikachu"
    assert search_key("ＧＴＡ") == "gta"  # fullwidth letters fold to plain ones
    assert search_key("俠盜獵車手 5") == "俠盜獵車手5"  # non-Latin letters stay
    assert search_key("+++") == ""
    assert search_key(None) == ""


def test_alternative_names_are_cleaned_and_deduplicated():
    assert alternative_names_from_igdb("Grand Theft Auto VI", GTA_ALTERNATIVE_NAMES) == [
        ("GTA 6", "Acronym"),
        ("GTA VI", "Acronym"),
        ("Grand Theft Auto 6", None),
    ]
    assert alternative_names_from_igdb("Anything", None) == []


def test_game_search_key_follows_its_name(db_session):
    game = _game(db_session, "GTA V", 1)
    assert game.search_key == "gtav"
    game.name = "Grand Theft Auto V"
    assert game.search_key == "grandtheftautov"


# --- library search ----------------------------------------------------------------------


def test_search_finds_a_game_by_alternative_name_and_says_which(auth_client, db_session):
    gta6 = _game(db_session, "Grand Theft Auto VI", 52189, ["GTA 6", "GTA VI"])
    _game(db_session, "Red Dead Redemption 2", 25076, ["RDR2"])

    [result] = _search(auth_client, "gta 6")
    assert result["id"] == gta6.id
    assert result["matchedAlias"] == "GTA 6"

    # Matching by its own name: no alias to explain it.
    [result] = _search(auth_client, "grand theft")
    assert result["matchedAlias"] is None

    # Several aliases match: listed once, with the first matching one.
    [result] = _search(auth_client, "gta")
    assert result["id"] == gta6.id
    assert result["matchedAlias"] == "GTA 6"


def test_search_ignores_punctuation_spaces_and_accents(auth_client, db_session):
    gta5 = _game(db_session, "Grand Theft Auto V", 1020, ["GTA V"])
    pokemon = _game(db_session, "Pokémon: Let's Go, Pikachu!", 100)

    assert [g["id"] for g in _search(auth_client, "gtav")] == [gta5.id]
    assert [g["id"] for g in _search(auth_client, "GTA-V")] == [gta5.id]
    assert [g["id"] for g in _search(auth_client, "pokemon lets go")] == [pokemon.id]
    assert [g["id"] for g in _search(auth_client, "letsgo")] == [pokemon.id]
    assert _search(auth_client, "gta 7") == []


def test_search_with_no_letters_or_digits_falls_back_to_the_name(auth_client, db_session):
    plus = _game(db_session, "Plus+", 1)
    _game(db_session, "Minus", 2)
    assert [g["id"] for g in _search(auth_client, "+")] == [plus.id]


def test_search_like_wildcards_are_not_wildcards(auth_client, db_session):
    _game(db_session, "Some Game", 1)
    assert _search(auth_client, "%") == []
    assert _search(auth_client, "_") == []


def test_share_page_search_matches_alternative_names(client, auth_client, db_session):
    gta6 = _game(db_session, "Grand Theft Auto VI", 52189, ["GTA 6"])
    token = auth_client.post("/api/share-link").json()["token"]
    body = client.get(f"/api/public/{token}/games", params={"search": "gta6"}).json()
    assert [g["id"] for g in body] == [gta6.id]


# --- import / resync ---------------------------------------------------------------------


def _payload(igdb_id: int, alternative_names: list[dict]) -> dict:
    return {"id": igdb_id, "name": "Grand Theft Auto VI", "category": 0, "alternative_names": alternative_names}


def test_game_fields_expand_alternative_names():
    assert "alternative_names.name,alternative_names.comment" in GAME_FIELDS


@respx.mock
def test_import_stores_alternative_names_and_the_detail_lists_them(auth_client, db_session, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[httpx.Response(200, json=[_payload(52189, GTA_ALTERNATIVE_NAMES)]), httpx.Response(200, json=[])]
    )

    response = auth_client.post("/api/games", json={"igdbId": 52189})

    assert response.status_code == 201, response.text
    assert response.json()["alternativeNames"] == [
        {"name": "GTA 6", "comment": "Acronym"},
        {"name": "GTA VI", "comment": "Acronym"},
        {"name": "Grand Theft Auto 6", "comment": None},
    ]
    assert [g["name"] for g in _search(auth_client, "gta 6")] == ["Grand Theft Auto VI"]


@respx.mock
async def test_resync_replaces_alternative_names(db_session, igdb_client):
    game = _game(db_session, "Grand Theft Auto VI", 52189, ["Old Name"])
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[
            httpx.Response(200, json=[_payload(52189, [{"name": "GTA 6", "comment": "Acronym"}])]),
            httpx.Response(200, json=[]),
        ]
    )

    await game_service.resync_game(db_session, igdb_client, game.id)

    names = db_session.query(GameAlternativeName.name).filter_by(game_id=game.id).all()
    assert [name for (name,) in names] == ["GTA 6"]


@respx.mock
async def test_collections_resync_leaves_alternative_names_alone(db_session, igdb_client):
    game = _game(db_session, "Grand Theft Auto VI", 52189, ["GTA 6"])
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        side_effect=[httpx.Response(200, json=[_payload(52189, [])]), httpx.Response(200, json=[])]
    )

    await game_service.resync_game(db_session, igdb_client, game.id, scope=CatalogSyncScope.COLLECTIONS)

    assert db_session.query(GameAlternativeName).filter_by(game_id=game.id).count() == 1


@respx.mock
def test_add_game_preview_lists_alternative_names(auth_client, igdb_client):
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    respx.post(f"{IGDB_API_BASE}/games").mock(
        return_value=httpx.Response(200, json=[_payload(52189, GTA_ALTERNATIVE_NAMES)])
    )
    respx.post(f"{IGDB_API_BASE}/covers").mock(return_value=httpx.Response(200, json=[]))

    response = auth_client.get("/api/igdb/games/52189")

    assert response.status_code == 200, response.text
    assert [a["name"] for a in response.json()["alternativeNames"]] == ["GTA 6", "GTA VI", "Grand Theft Auto 6"]


# --- deletes and backup ------------------------------------------------------------------


def test_deleting_a_game_deletes_its_alternative_names(auth_client, db_session):
    game = _game(db_session, "Grand Theft Auto VI", 52189, ["GTA 6"])
    assert auth_client.delete(f"/api/games/{game.id}").status_code == 204
    assert db_session.query(GameAlternativeName).count() == 0


def test_restore_clears_alternative_names_and_restored_games_get_their_search_key(db_session):
    _game(db_session, "Grand Theft Auto V", 1020, ["GTA 5"])

    backup_service.restore_backup(db_session, backup_service.build_backup_payload(db_session))
    db_session.commit()

    # Catalog data, not in the backup: the post-restore resync brings it back.
    assert db_session.query(GameAlternativeName).count() == 0
    assert db_session.query(Game.search_key).one() == ("grandtheftautov",)


# --- the Fetch alternative names job -----------------------------------------------------


@respx.mock
async def test_client_fetches_alternative_names_by_ids_in_one_request():
    respx.post(IGDB_TOKEN_URL).mock(return_value=TOKEN_RESPONSE)
    route = respx.post(f"{IGDB_API_BASE}/games").mock(
        return_value=httpx.Response(
            200, json=[{"id": 1, "alternative_names": [{"id": 9, "name": "GTA 5", "comment": "Acronym"}]}, {"id": 2}]
        )
    )
    client = IGDBClient(client_id="id", client_secret="secret")

    result = await client.get_alternative_names_by_ids([1, 2])
    await client.aclose()

    body = route.calls.last.request.content.decode()
    assert "fields alternative_names.name,alternative_names.comment;" in body
    assert "where id = (1,2);" in body
    assert "limit 2;" in body
    assert result == {1: [{"id": 9, "name": "GTA 5", "comment": "Acronym"}], 2: []}


def test_job_fills_alternative_names_in_batches(db_session, monkeypatch):
    gta5 = _game(db_session, "Grand Theft Auto V", 1020)
    rdr2 = _game(db_session, "Red Dead Redemption 2", 25076, ["Old"])
    gone = _game(db_session, "Removed From IGDB", 999)
    gone_id, gone_name = gone.id, gone.name
    custom = Game(name="Custom Game", category=GameCategory.MAIN_GAME)  # no igdb_id: skipped
    db_session.add(custom)
    db_session.commit()
    gta5_id, rdr2_id = gta5.id, rdr2.id

    requested: list[list[int]] = []

    async def fake_fetch(self, ids):
        requested.append(list(ids))
        return {
            1020: [{"name": "GTA 5", "comment": "Acronym"}, {"name": "GTAV", "comment": "Acronym"}],
            25076: [{"name": "RDR2", "comment": "Acronym"}],
        }

    monkeypatch.setattr(IGDBClient, "get_alternative_names_by_ids", fake_fetch)
    monkeypatch.setattr(alternative_names_job, "ALTERNATIVE_NAMES_BATCH_SIZE", 2)
    monkeypatch.setattr(alternative_names_job, "_PACE_DELAY_SECONDS", 0)
    progress: list[tuple[int, int]] = []

    result = alternative_names_job.DEFINITION_ALTERNATIVE_NAMES.run(
        lambda: db_session, lambda current, total: progress.append((current, total))
    )

    assert requested == [[1020, 25076], [999]]
    assert progress == [(2, 3), (3, 3)]
    assert result == {
        "total": 3,
        "succeeded": 2,
        "failed": 1,
        "failures": [{"game_id": gone_id, "game_name": gone_name, "error": "Not found on IGDB"}],
    }
    names = {
        (game_id, name) for game_id, name in db_session.query(GameAlternativeName.game_id, GameAlternativeName.name)
    }
    assert names == {(gta5_id, "GTA 5"), (gta5_id, "GTAV"), (rdr2_id, "RDR2")}


def test_job_isolates_a_failed_batch(db_session, monkeypatch):
    _game(db_session, "First", 1)
    second = _game(db_session, "Second", 2)
    second_id = second.id
    calls = 0

    async def fake_fetch(self, ids):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError("IGDB is down")
        return {2: [{"name": "2nd", "comment": None}]}

    monkeypatch.setattr(IGDBClient, "get_alternative_names_by_ids", fake_fetch)
    monkeypatch.setattr(alternative_names_job, "ALTERNATIVE_NAMES_BATCH_SIZE", 1)
    monkeypatch.setattr(alternative_names_job, "_PACE_DELAY_SECONDS", 0)

    result = alternative_names_job.DEFINITION_ALTERNATIVE_NAMES.run(lambda: db_session)

    assert (result["succeeded"], result["failed"]) == (1, 1)
    assert result["failures"][0]["error"] == "IGDB is down"
    assert [game_id for (game_id,) in db_session.query(GameAlternativeName.game_id)] == [second_id]


def test_job_is_listed(auth_client):
    jobs = {job["id"] for job in auth_client.get("/api/jobs").json()}
    assert "alternative_names" in jobs
