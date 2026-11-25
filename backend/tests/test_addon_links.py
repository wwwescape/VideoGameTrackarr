"""Manual add-on links: an add-on linked to more games than its IGDB parent, from either side,
without ever touching IGDB's own link (parent_game_id)."""

import io
import json
import time

import httpx
import pytest
import respx

from app.models.catalog import (
    Collection,
    Franchise,
    Game,
    GameAddonLink,
    GameAlternativeName,
    GameCategory,
    GameCollection,
    GameFranchise,
)
from app.models.labs import LAB_LINKED_ADDONS, LabFeature
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.services import edition_service, game_service
from app.services.igdb_client import IGDB_API_BASE, IGDB_TOKEN_URL


@pytest.fixture(autouse=True)
def linked_addons_lab(db_session):
    """The Linked Add-ons lab on; the lab-off tests below turn it off again."""
    db_session.add(LabFeature(id=LAB_LINKED_ADDONS, enabled=True))
    db_session.commit()


@pytest.fixture(autouse=True)
def _fresh_edition_backoff(igdb_client):
    """edition_service remembers an IGDB failure for a while; each test starts clean. The
    candidate routes always take an IGDB client (to fill in editions), so every test gets one."""
    edition_service._last_failure = None


def _lab_off(db_session) -> None:
    db_session.get(LabFeature, LAB_LINKED_ADDONS).enabled = False
    db_session.commit()


@pytest.fixture()
def fh5(db_session, seed_platform):
    """Forza Horizon 5's Standard and Premium editions, a car pack IGDB lists under Standard
    only, an add-on with no IGDB parent here, plus an unrelated game and add-on."""
    series = Collection(name="Forza Horizon", slug="forza-horizon", igdb_id=1)
    franchise = Franchise(name="Forza", slug="forza", igdb_id=2)
    other_series = Collection(name="Zelda", slug="zelda", igdb_id=3)
    db_session.add_all([series, franchise, other_series])
    db_session.flush()

    # Editions as IGDB records them: Premium is a version of Standard (version_parent).
    checked = {"version_parent_checked": True}
    standard = Game(name="Forza Horizon 5", category=GameCategory.MAIN_GAME, igdb_id=100, **checked)
    premium = Game(
        name="Forza Horizon 5: Premium Edition",
        category=GameCategory.BUNDLE,
        igdb_id=171270,
        version_parent_igdb_id=100,
        **checked,
    )
    motorsport = Game(name="Forza Motorsport", category=GameCategory.MAIN_GAME, igdb_id=101, **checked)
    zelda = Game(name="Zelda", category=GameCategory.MAIN_GAME, igdb_id=102, **checked)
    db_session.add_all([standard, premium, motorsport, zelda])
    db_session.flush()
    car_pack = Game(
        name="Forza Horizon 5: Car Collection",
        category=GameCategory.PACK,
        igdb_id=200,
        parent_game_id=standard.id,
        **checked,
    )
    zelda_dlc = Game(name="Zelda DLC", category=GameCategory.DLC_ADDON, igdb_id=201, parent_game_id=zelda.id, **checked)
    orphan = Game(name="Forza Horizon 5: Rally Adventure", category=GameCategory.EXPANSION, igdb_id=202, **checked)
    db_session.add_all([car_pack, zelda_dlc, orphan])
    db_session.flush()

    for game in (standard, premium):
        db_session.add(GameCollection(game_id=game.id, collection_id=series.id))
    for game in (standard, premium, motorsport):
        db_session.add(GameFranchise(game_id=game.id, franchise_id=franchise.id))
    db_session.add(GameCollection(game_id=zelda.id, collection_id=other_series.id))
    db_session.add(GameCollection(game_id=orphan.id, collection_id=series.id))
    db_session.add(
        LibraryItem(
            game_id=premium.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED, format=MediaFormat.DIGITAL
        )
    )
    db_session.commit()
    return {
        "standard": standard,
        "premium": premium,
        "motorsport": motorsport,
        "zelda": zelda,
        "car_pack": car_pack,
        "zelda_dlc": zelda_dlc,
        "orphan": orphan,
    }


def _names(response) -> list[str]:
    assert response.status_code == 200, response.text
    return [game["name"] for game in response.json()]


def _link(client, game_id: int, ids: list[int]):
    return client.post(f"/api/games/{game_id}/addon-links", json={"ids": ids})


def test_link_from_an_add_on_shows_on_both_sides(auth_client, db_session, fh5):
    car_pack, premium, standard = fh5["car_pack"], fh5["premium"], fh5["standard"]
    response = _link(auth_client, car_pack.id, [premium.id])
    assert response.status_code == 200, response.text
    assert response.json() == {"added": 1}

    works_with = auth_client.get(f"/api/games/{car_pack.id}/works-with").json()
    assert [(g["name"], g["manualLink"]) for g in works_with] == [
        ("Forza Horizon 5", False),
        ("Forza Horizon 5: Premium Edition", True),
    ]
    addons = auth_client.get(f"/api/games/{premium.id}/addons").json()
    assert [(g["name"], g["manualLink"]) for g in addons] == [("Forza Horizon 5: Car Collection", True)]
    # IGDB's own link is untouched.
    standard_addons = auth_client.get(f"/api/games/{standard.id}/addons").json()
    assert [(g["name"], g["manualLink"]) for g in standard_addons] == [("Forza Horizon 5: Car Collection", False)]
    db_session.expire_all()
    assert db_session.get(Game, car_pack.id).parent_game_id == standard.id


def test_link_from_a_game_and_linking_again_is_a_no_op(auth_client, fh5):
    premium = fh5["premium"]
    assert _link(auth_client, premium.id, [fh5["car_pack"].id, fh5["orphan"].id]).json() == {"added": 2}
    assert _link(auth_client, premium.id, [fh5["car_pack"].id]).json() == {"added": 0}
    assert _names(auth_client.get(f"/api/games/{premium.id}/addons")) == [
        "Forza Horizon 5: Car Collection",
        "Forza Horizon 5: Rally Adventure",
    ]


@pytest.mark.parametrize(
    ("side", "others"),
    [
        ("car_pack", ["standard"]),  # its own IGDB parent
        ("car_pack", ["zelda_dlc"]),  # an add-on to an add-on
        ("car_pack", ["car_pack"]),  # itself
        ("premium", ["motorsport"]),  # two games
        ("premium", ["car_pack", "standard"]),  # one bad id links none
    ],
)
def test_invalid_links_are_refused(auth_client, db_session, fh5, side, others):
    response = _link(auth_client, fh5[side].id, [fh5[name].id for name in others])
    assert response.status_code == 409, response.text
    assert db_session.query(GameAddonLink).count() == 0


def test_unknown_ids_are_404(auth_client, fh5):
    assert _link(auth_client, fh5["car_pack"].id, [999999]).status_code == 404
    assert _link(auth_client, 999999, [fh5["premium"].id]).status_code == 404


def test_unlink_from_either_side(auth_client, fh5):
    car_pack, premium = fh5["car_pack"], fh5["premium"]
    _link(auth_client, car_pack.id, [premium.id])
    assert auth_client.delete(f"/api/games/{premium.id}/addon-links/{car_pack.id}").status_code == 204
    assert _names(auth_client.get(f"/api/games/{premium.id}/addons")) == []
    assert auth_client.delete(f"/api/games/{car_pack.id}/addon-links/{premium.id}").status_code == 404


def test_last_link_of_an_add_on_with_no_parent_cannot_be_removed(auth_client, fh5):
    orphan, premium, standard = fh5["orphan"], fh5["premium"], fh5["standard"]
    _link(auth_client, orphan.id, [premium.id, standard.id])
    assert auth_client.delete(f"/api/games/{orphan.id}/addon-links/{standard.id}").status_code == 204
    response = auth_client.delete(f"/api/games/{orphan.id}/addon-links/{premium.id}")
    assert response.status_code == 409
    assert response.json()["detail"] == "last_link_orphan"
    # An add-on with an IGDB parent can lose its last manual link.
    _link(auth_client, fh5["car_pack"].id, [premium.id])
    assert auth_client.delete(f"/api/games/{fh5['car_pack'].id}/addon-links/{premium.id}").status_code == 204


def test_candidates_for_an_add_on_are_the_other_editions_of_its_game(auth_client, fh5):
    car_pack = fh5["car_pack"]
    _link(auth_client, car_pack.id, [fh5["premium"].id])
    body = auth_client.get(f"/api/games/{car_pack.id}/addon-links/candidates").json()
    # Its own IGDB parent, add-ons, Forza Motorsport (same series) and Zelda are left out.
    assert [(c["name"], c["edition"], c["linked"]) for c in body] == [
        ("Forza Horizon 5: Premium Edition", None, True),
    ]


def test_candidate_search_matches_alternative_names_and_ignores_punctuation(auth_client, db_session, fh5):
    db_session.add(GameAlternativeName(game_id=fh5["orphan"].id, name="FH5 RA", comment="Acronym"))
    db_session.commit()
    _link(auth_client, fh5["orphan"].id, [fh5["standard"].id])
    url = f"/api/games/{fh5['premium'].id}/addon-links/candidates"
    assert _names(auth_client.get(url, params={"q": "fh5 ra"})) == ["Forza Horizon 5: Rally Adventure"]
    assert _names(auth_client.get(url, params={"q": "5:car"})) == ["Forza Horizon 5: Car Collection"]


def test_candidates_for_a_game_are_the_other_editions_add_ons(auth_client, fh5):
    premium, standard = fh5["premium"], fh5["standard"]
    body = auth_client.get(f"/api/games/{premium.id}/addon-links/candidates").json()
    assert [(c["name"], c["edition"]["name"]) for c in body] == [("Forza Horizon 5: Car Collection", "Forza Horizon 5")]
    # Add-ons linked to an edition count as that edition's; a game's own IGDB add-ons don't.
    _link(auth_client, fh5["orphan"].id, [premium.id])
    body = auth_client.get(f"/api/games/{standard.id}/addon-links/candidates").json()
    assert [(c["name"], c["edition"]["name"]) for c in body] == [
        ("Forza Horizon 5: Rally Adventure", "Forza Horizon 5: Premium Edition")
    ]
    assert auth_client.get(f"/api/games/{fh5['motorsport'].id}/addon-links/candidates").json() == []


@respx.mock
def test_editions_missing_from_older_imports_are_read_from_igdb_once(auth_client, db_session, fh5):
    premium = fh5["premium"]
    premium.version_parent_igdb_id = None
    premium.version_parent_checked = False
    db_session.commit()
    respx.post(IGDB_TOKEN_URL).mock(return_value=httpx.Response(200, json={"access_token": "t", "expires_in": 3600}))
    route = respx.post(f"{IGDB_API_BASE}/games").mock(
        return_value=httpx.Response(200, json=[{"id": 171270, "version_parent": 100}])
    )
    url = f"/api/games/{premium.id}/addon-links/candidates"

    assert _names(auth_client.get(url)) == ["Forza Horizon 5: Car Collection"]
    assert _names(auth_client.get(url)) == ["Forza Horizon 5: Car Collection"]
    assert route.call_count == 1
    db_session.expire_all()
    assert (premium.version_parent_igdb_id, premium.version_parent_checked) == (100, True)


def test_an_import_stores_the_version_parent(db_session):
    game = game_service._upsert_from_igdb_payload(
        db_session, {"id": 900, "name": "Some Game: Deluxe", "game_type": 0, "version_parent": 899}
    )
    assert (game.version_parent_igdb_id, game.version_parent_checked) == (899, True)


def test_include_add_ons_filter_matches_through_a_manual_link(auth_client, fh5):
    def games(**params):
        return {g["name"]: g["matchedViaAddon"] for g in auth_client.get("/api/games", params=params).json()}

    assert "Forza Horizon 5: Premium Edition" not in games(search="Car Collection", includeAddons=True)
    _link(auth_client, fh5["car_pack"].id, [fh5["premium"].id])
    assert games(search="Car Collection", includeAddons=True)["Forza Horizon 5: Premium Edition"] is True


def test_deleting_the_parent_keeps_a_linked_add_on_detached(auth_client, db_session, fh5):
    car_pack, premium, standard = fh5["car_pack"], fh5["premium"], fh5["standard"]
    car_pack_id, premium_id = car_pack.id, premium.id
    _link(auth_client, car_pack.id, [premium.id])

    preview = auth_client.get(f"/api/games/{standard.id}/removal-preview").json()
    assert [a["name"] for a in preview["keptAddons"]] == ["Forza Horizon 5: Car Collection"]

    assert auth_client.delete(f"/api/games/{standard.id}").status_code == 204
    db_session.expire_all()
    kept = db_session.get(Game, car_pack_id)
    assert kept is not None and kept.parent_game_id is None
    assert _names(auth_client.get(f"/api/games/{premium_id}/addons")) == ["Forza Horizon 5: Car Collection"]


def test_deleting_the_only_linked_game_deletes_an_add_on_with_no_parent(auth_client, db_session, fh5):
    orphan_id, premium = fh5["orphan"].id, fh5["premium"]
    _link(auth_client, orphan_id, [premium.id])
    assert auth_client.get(f"/api/games/{premium.id}/removal-preview").json() == {"keptAddons": []}
    assert auth_client.delete(f"/api/games/{premium.id}").status_code == 204
    db_session.expire_all()
    assert db_session.get(Game, orphan_id) is None
    assert db_session.query(GameAddonLink).count() == 0


def test_deleting_a_linked_game_leaves_an_add_on_with_its_parent_alone(auth_client, db_session, fh5):
    car_pack_id, standard_id, premium = fh5["car_pack"].id, fh5["standard"].id, fh5["premium"]
    _link(auth_client, car_pack_id, [premium.id])
    assert auth_client.delete(f"/api/games/{premium.id}").status_code == 204
    db_session.expire_all()
    assert db_session.get(Game, car_pack_id).parent_game_id == standard_id
    assert db_session.query(GameAddonLink).count() == 0


def test_a_resync_keeps_a_detached_add_on_parentless_and_linked(db_session, fh5):
    orphan, premium = fh5["orphan"], fh5["premium"]
    db_session.add(GameAddonLink(addon_game_id=orphan.id, game_id=premium.id))
    db_session.commit()
    # IGDB still names a parent that isn't in the library.
    payload = {
        "id": orphan.igdb_id,
        "name": orphan.name,
        "game_type": 2,
        "parent_game": {"id": 424242, "name": "Forza Horizon 5", "url": "https://www.igdb.com/games/forza-horizon-5"},
    }
    game_service._upsert_from_igdb_payload(db_session, payload)
    db_session.commit()
    db_session.expire_all()
    assert db_session.get(Game, orphan.id).parent_game_id is None
    assert db_session.query(GameAddonLink).filter_by(addon_game_id=orphan.id, game_id=premium.id).count() == 1


def test_links_round_trip_through_a_backup(auth_client, db_session, fh5):
    _link(auth_client, fh5["orphan"].id, [fh5["premium"].id])
    _link(auth_client, fh5["car_pack"].id, [fh5["premium"].id])
    body = auth_client.get("/api/export/backup").json()
    assert body["version"] == 13
    assert len(body["addon_links"]) == 2

    db_session.query(GameAddonLink).delete()
    db_session.commit()
    raw = json.dumps(body).encode("utf-8")
    response = auth_client.post(
        "/api/import/backup", files={"file": ("backup.json", io.BytesIO(raw), "application/json")}
    )
    assert response.status_code == 202
    deadline = time.monotonic() + 5
    while auth_client.get("/api/import/backup/status").json()["status"] == "running":
        assert time.monotonic() < deadline
        time.sleep(0.02)

    db_session.expire_all()
    pairs = {(link.addon_game_id, link.game_id) for link in db_session.query(GameAddonLink)}
    assert pairs == {(fh5["orphan"].id, fh5["premium"].id), (fh5["car_pack"].id, fh5["premium"].id)}
    # The orphan is still there without a parent, held by its link.
    assert db_session.get(Game, fh5["orphan"].id).parent_game_id is None


# --- Add-ons from the base game (IGDB mocked) ---------------------------------------------

FH5_IGDB = {"id": 100, "name": "Forza Horizon 5", "slug": "forza-horizon-5", "url": "https://www.igdb.com/games/fh5"}


def _mock_igdb(version_parent: dict | None, addons: list[dict]) -> None:
    """IGDB's /games answers the version_parent lookup and the base game's add-ons query."""
    respx.post(IGDB_TOKEN_URL).mock(return_value=httpx.Response(200, json={"access_token": "t", "expires_in": 3600}))

    def games(request: httpx.Request) -> httpx.Response:
        body = request.content.decode()
        if "version_parent" in body:
            return httpx.Response(200, json=[{"id": 1, "version_parent": version_parent}])
        return httpx.Response(200, json=addons)

    respx.post(f"{IGDB_API_BASE}/games").mock(side_effect=games)


def _addon_payload(igdb_id: int, name: str, parent_igdb_id: int = 100, game_type: int = 13) -> dict:
    return {"id": igdb_id, "name": name, "game_type": game_type, "parent_game": {"id": parent_igdb_id, "name": "Base"}}


@respx.mock
def test_base_game_addons_are_listed_with_their_library_state(auth_client, igdb_client, fh5):
    _link(auth_client, fh5["car_pack"].id, [fh5["premium"].id])
    _mock_igdb(
        FH5_IGDB, [_addon_payload(300, "Forza Horizon 5: VIP"), _addon_payload(200, "Forza Horizon 5: Car Collection")]
    )

    body = auth_client.get(f"/api/games/{fh5['premium'].id}/base-game-addons").json()

    assert body["baseGame"] == {"igdbId": 100, "name": "Forza Horizon 5", "gameId": fh5["standard"].id}
    assert [(a["name"], a["gameId"], a["linked"], a["category"]) for a in body["addons"]] == [
        ("Forza Horizon 5: Car Collection", fh5["car_pack"].id, True, "pack"),
        ("Forza Horizon 5: VIP", None, False, "pack"),
    ]


@respx.mock
def test_no_base_game_on_igdb_offers_nothing(auth_client, igdb_client, db_session, fh5):
    # Not known locally yet, so IGDB is asked.
    fh5["premium"].version_parent_checked = False
    db_session.commit()
    _mock_igdb(None, [])
    assert auth_client.get(f"/api/games/{fh5['premium'].id}/base-game-addons").json() == {
        "baseGame": None,
        "addons": [],
    }


def test_a_base_game_known_to_have_none_skips_igdb(auth_client, igdb_client, fh5):
    # Standard is checked and has no version_parent: nothing asks IGDB (nothing is mocked).
    assert auth_client.get(f"/api/games/{fh5['standard'].id}/base-game-addons").json()["baseGame"] is None


def test_add_ons_and_custom_games_have_no_base_game(auth_client, igdb_client, db_session, fh5):
    custom = Game(name="My Game", category=GameCategory.MAIN_GAME)
    db_session.add(custom)
    db_session.commit()
    for game_id in (fh5["car_pack"].id, custom.id):
        assert auth_client.get(f"/api/games/{game_id}/base-game-addons").json()["baseGame"] is None


@respx.mock
def test_picked_add_ons_are_imported_without_a_parent_and_linked(auth_client, igdb_client, db_session, fh5):
    # An edition whose base game isn't in the library.
    edition = Game(name="Zelda: Deluxe", category=GameCategory.BUNDLE, igdb_id=500)
    db_session.add(edition)
    db_session.commit()
    _mock_igdb(
        {"id": 999, "name": "Zelda Base"},
        [_addon_payload(600, "Zelda Pack", parent_igdb_id=999), _addon_payload(601, "Zelda Pass", parent_igdb_id=999)],
    )

    response = auth_client.post(f"/api/games/{edition.id}/base-game-addons", json={"igdbIds": [600, 12345]})

    assert response.status_code == 200, response.text
    [imported, missing] = response.json()["results"]
    assert (imported["igdbId"], imported["status"]) == (600, "linked")
    assert (missing["igdbId"], missing["status"], missing["gameId"]) == (12345, "failed", None)
    db_session.expire_all()
    pack = db_session.get(Game, imported["gameId"])
    assert (pack.name, pack.parent_game_id, pack.auto_discovered) == ("Zelda Pack", None, False)
    assert _names(auth_client.get(f"/api/games/{edition.id}/addons")) == ["Zelda Pack"]
    # Neither the base game nor the add-on shows up on the Games list.
    names = _names(auth_client.get("/api/games"))
    assert "Zelda Pack" not in names and "Zelda Base" not in names


@respx.mock
def test_linking_an_add_on_already_in_the_library_just_links_it(auth_client, igdb_client, db_session, fh5):
    _mock_igdb(FH5_IGDB, [_addon_payload(200, "Forza Horizon 5: Car Collection")])
    premium = fh5["premium"]

    first = auth_client.post(f"/api/games/{premium.id}/base-game-addons", json={"igdbIds": [200]}).json()
    again = auth_client.post(f"/api/games/{premium.id}/base-game-addons", json={"igdbIds": [200]}).json()

    assert first["results"] == [{"igdbId": 200, "status": "linked", "gameId": fh5["car_pack"].id}]
    assert again["results"] == [{"igdbId": 200, "status": "already_linked", "gameId": fh5["car_pack"].id}]
    db_session.expire_all()
    assert db_session.get(Game, fh5["car_pack"].id).parent_game_id == fh5["standard"].id
    assert db_session.query(Game).filter(Game.igdb_id == 200).count() == 1


def test_linking_base_game_add_ons_to_an_add_on_is_refused(auth_client, igdb_client, fh5):
    response = auth_client.post(f"/api/games/{fh5['car_pack'].id}/base-game-addons", json={"igdbIds": [1]})
    assert response.status_code == 409


# --- The Linked Add-ons lab -----------------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("get", "/api/games/{addon}/works-with", None),
        ("get", "/api/games/{addon}/addon-links/candidates", None),
        ("post", "/api/games/{addon}/addon-links", {"ids": [1]}),
        ("delete", "/api/games/{addon}/addon-links/{game}", None),
        ("get", "/api/games/{game}/base-game-addons", None),
        ("post", "/api/games/{game}/base-game-addons", {"igdbIds": [1]}),
        ("get", "/api/addon-links", None),
    ],
)
def test_link_routes_are_404_while_the_lab_is_off(auth_client, db_session, fh5, method, path, body):
    _lab_off(db_session)
    url = path.format(addon=fh5["car_pack"].id, game=fh5["premium"].id)
    kwargs = {"json": body} if body is not None else {}
    assert getattr(auth_client, method)(url, **kwargs).status_code == 404


def test_links_are_kept_but_count_nowhere_while_the_lab_is_off(auth_client, db_session, fh5):
    car_pack, premium = fh5["car_pack"], fh5["premium"]
    _link(auth_client, car_pack.id, [premium.id])
    _lab_off(db_session)

    assert _names(auth_client.get(f"/api/games/{premium.id}/addons")) == []
    listed = auth_client.get("/api/games", params={"search": "Car Collection", "includeAddons": True}).json()
    games = {g["name"] for g in listed}
    assert "Forza Horizon 5: Premium Edition" not in games
    assert db_session.query(GameAddonLink).count() == 1

    # Turned back on, the link is there again.
    auth_client.put("/api/labs/linked_addons", json={"enabled": True})
    assert _names(auth_client.get(f"/api/games/{premium.id}/addons")) == ["Forza Horizon 5: Car Collection"]


def test_deletes_keep_linked_add_ons_even_while_the_lab_is_off(auth_client, db_session, fh5):
    car_pack_id, standard = fh5["car_pack"].id, fh5["standard"]
    _link(auth_client, car_pack_id, [fh5["premium"].id])
    _lab_off(db_session)

    names = [a["name"] for a in auth_client.get(f"/api/games/{standard.id}/removal-preview").json()["keptAddons"]]
    assert names == ["Forza Horizon 5: Car Collection"]
    assert auth_client.delete(f"/api/games/{standard.id}").status_code == 204
    db_session.expire_all()
    assert db_session.get(Game, car_pack_id).parent_game_id is None


def test_settings_lists_every_link(auth_client, fh5):
    _link(auth_client, fh5["premium"].id, [fh5["car_pack"].id, fh5["orphan"].id])
    body = auth_client.get("/api/addon-links").json()
    assert [(row["addon"]["name"], row["game"]["name"]) for row in body] == [
        ("Forza Horizon 5: Car Collection", "Forza Horizon 5: Premium Edition"),
        ("Forza Horizon 5: Rally Adventure", "Forza Horizon 5: Premium Edition"),
    ]


# --- Included -------------------------------------------------------------------------------


def test_linking_as_included_counts_the_add_on_as_owned(auth_client, fh5):
    car_pack, premium = fh5["car_pack"], fh5["premium"]
    response = auth_client.post(
        f"/api/games/{premium.id}/addon-links", json={"ids": [car_pack.id], "includedIds": [car_pack.id]}
    )
    assert response.json() == {"added": 1}

    [addon] = auth_client.get(f"/api/games/{premium.id}/addons").json()
    # Premium is owned (see the fixture), so the included car pack is too.
    assert (addon["manualLink"], addon["included"], addon["owned"]) == (True, True, True)
    detail = auth_client.get(f"/api/games/{car_pack.id}/works-with").json()
    assert [(g["name"], g["included"]) for g in detail] == [
        ("Forza Horizon 5", False),
        ("Forza Horizon 5: Premium Edition", True),
    ]


def test_included_can_be_set_on_a_link_and_on_the_igdb_parent(auth_client, db_session, fh5):
    car_pack, premium, standard = fh5["car_pack"], fh5["premium"], fh5["standard"]
    _link(auth_client, car_pack.id, [premium.id])
    url = f"/api/games/{car_pack.id}/addon-links/{premium.id}/relation"
    assert auth_client.put(url, json={"relation": "included"}).status_code == 204
    assert db_session.query(GameAddonLink).filter_by(game_id=premium.id).one().included is True
    assert auth_client.put(url, json={"relation": "works_with"}).status_code == 204
    db_session.expire_all()
    # A manual link stays when un-included.
    assert db_session.query(GameAddonLink).filter_by(game_id=premium.id).one().included is False

    # The IGDB parent: the row exists only while included, and isn't a link to unlink.
    parent_url = f"/api/games/{standard.id}/addon-links/{car_pack.id}/relation"
    assert auth_client.put(parent_url, json={"relation": "included"}).status_code == 204
    [addon] = auth_client.get(f"/api/games/{standard.id}/addons").json()
    assert (addon["manualLink"], addon["included"]) == (False, True)
    assert auth_client.delete(f"/api/games/{car_pack.id}/addon-links/{standard.id}").status_code == 404
    assert auth_client.put(parent_url, json={"relation": "works_with"}).status_code == 204
    db_session.expire_all()
    assert db_session.query(GameAddonLink).filter_by(game_id=standard.id).count() == 0


def test_included_needs_a_link(auth_client, fh5):
    url = f"/api/games/{fh5['car_pack'].id}/addon-links/{fh5['motorsport'].id}/relation"
    assert auth_client.put(url, json={"relation": "included"}).status_code == 404


def test_an_included_add_on_shows_owned_via_and_leaves_missing_dlc(auth_client, db_session, seed_platform, fh5):
    car_pack, premium, standard = fh5["car_pack"], fh5["premium"], fh5["standard"]
    # Owning Standard too makes its car pack "missing" until Premium covers it.
    db_session.add(
        LibraryItem(
            game_id=standard.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED, format=MediaFormat.DIGITAL
        )
    )
    db_session.commit()

    def missing_names() -> set[str]:
        rows = auth_client.get("/api/insights/missing-addons").json()
        return {addon["name"] for row in rows for addon in row["missingAddons"]}

    assert "Forza Horizon 5: Car Collection" in missing_names()
    _link(auth_client, car_pack.id, [premium.id])
    auth_client.put(f"/api/games/{car_pack.id}/addon-links/{premium.id}/relation", json={"relation": "included"})

    assert "Forza Horizon 5: Car Collection" not in missing_names()
    detail = auth_client.get(f"/api/games/{car_pack.slug or car_pack.uuid}").json()
    assert detail["owned"] is True
    assert [g["name"] for g in detail["ownedVia"]] == ["Forza Horizon 5: Premium Edition"]


def test_included_counts_nowhere_while_the_lab_is_off(auth_client, db_session, fh5):
    car_pack, premium = fh5["car_pack"], fh5["premium"]
    auth_client.post(f"/api/games/{premium.id}/addon-links", json={"ids": [car_pack.id], "includedIds": [car_pack.id]})
    _lab_off(db_session)
    assert auth_client.get(f"/api/games/{premium.id}/addons").json() == []
    assert db_session.query(GameAddonLink).one().included is True


def test_backup_round_trips_the_included_mark(auth_client, fh5):
    car_pack, premium = fh5["car_pack"], fh5["premium"]
    auth_client.post(f"/api/games/{premium.id}/addon-links", json={"ids": [car_pack.id], "includedIds": [car_pack.id]})
    body = auth_client.get("/api/export/backup").json()
    assert body["addon_links"] == [
        {"addon_game_id": car_pack.id, "game_id": premium.id, "included": True, "preorder_bonus": False}
    ]


@respx.mock
def test_base_game_add_ons_in_the_editions_bundle_are_suggested_as_included(auth_client, igdb_client, fh5):
    premium = fh5["premium"]
    in_bundle = {**_addon_payload(300, "Forza Horizon 5: VIP"), "bundles": [premium.igdb_id]}
    _mock_igdb(FH5_IGDB, [in_bundle, _addon_payload(301, "Forza Horizon 5: Car Pass")])

    body = auth_client.get(f"/api/games/{premium.id}/base-game-addons").json()
    assert [(a["name"], a["suggestedIncluded"]) for a in body["addons"]] == [
        ("Forza Horizon 5: Car Pass", False),
        ("Forza Horizon 5: VIP", True),
    ]
    results = auth_client.post(
        f"/api/games/{premium.id}/base-game-addons", json={"igdbIds": [300], "includedIgdbIds": [300]}
    ).json()["results"]
    assert results[0]["status"] == "linked"
    [addon] = auth_client.get(f"/api/games/{premium.id}/addons").json()
    assert (addon["name"], addon["included"], addon["owned"]) == ("Forza Horizon 5: VIP", True, True)


# --- Packs ----------------------------------------------------------------------------------
# A Season Pass / Ultimate Pack IGDB leaves out, added as a custom Pack holding other add-ons.


@pytest.fixture()
def season_pass(db_session, fh5):
    """Two custom packs for FH5 Standard (a Season Pass and an Ultimate Pack) and the Hot Wheels
    expansion IGDB lists there. The fixture's IGDB Car Collection is a Pack too, but holds
    nothing: IGDB files single add-ons as Packs."""
    standard = fh5["standard"]
    pass_ = Game(name="Forza Horizon 5: Expansions Bundle", category=GameCategory.PACK, parent_game_id=standard.id)
    ultimate = Game(name="Forza Horizon 5: Ultimate Pack", category=GameCategory.PACK, parent_game_id=standard.id)
    hot_wheels = Game(
        name="Forza Horizon 5: Hot Wheels",
        category=GameCategory.EXPANSION,
        igdb_id=203,
        parent_game_id=standard.id,
        version_parent_checked=True,
    )
    db_session.add_all([pass_, ultimate, hot_wheels])
    db_session.commit()
    return {**fh5, "pass": pass_, "ultimate": ultimate, "hot_wheels": hot_wheels}


def _pack(client, game_id: int, ids: list[int]):
    return client.post(f"/api/games/{game_id}/pack-links", json={"ids": ids})


def test_contents_are_added_from_the_pack_or_from_the_add_on(auth_client, season_pass):
    pass_, hot_wheels, orphan = season_pass["pass"], season_pass["hot_wheels"], season_pass["orphan"]
    assert _pack(auth_client, pass_.id, [hot_wheels.id]).json() == {"added": 1}
    # From the add-on's side the ids are packs.
    assert _pack(auth_client, orphan.id, [pass_.id]).json() == {"added": 1}

    contents = auth_client.get(f"/api/games/{pass_.id}/pack-contents").json()
    assert [(g["name"], g["included"]) for g in contents] == [
        ("Forza Horizon 5: Hot Wheels", True),
        ("Forza Horizon 5: Rally Adventure", True),
    ]
    assert _names(auth_client.get(f"/api/games/{hot_wheels.id}/packs")) == ["Forza Horizon 5: Expansions Bundle"]
    # A pack isn't a game the add-on works with.
    assert _names(auth_client.get(f"/api/games/{hot_wheels.id}/works-with")) == ["Forza Horizon 5"]


def test_only_a_pack_holds_add_ons_and_never_in_a_loop(auth_client, season_pass):
    pass_, hot_wheels, ultimate = season_pass["pass"], season_pass["hot_wheels"], season_pass["ultimate"]
    assert _pack(auth_client, hot_wheels.id, [season_pass["zelda_dlc"].id]).status_code == 409
    assert _pack(auth_client, pass_.id, [season_pass["premium"].id]).status_code == 409
    assert _pack(auth_client, pass_.id, [pass_.id]).status_code == 409
    # Packs nest (an Ultimate Pack holding a Season Pass), but not in a loop.
    assert _pack(auth_client, ultimate.id, [pass_.id]).status_code == 200
    assert _pack(auth_client, pass_.id, [ultimate.id]).status_code == 409


def test_a_pack_included_in_an_owned_game_owns_its_contents(auth_client, season_pass):
    pass_, hot_wheels, premium = season_pass["pass"], season_pass["hot_wheels"], season_pass["premium"]
    _pack(auth_client, pass_.id, [hot_wheels.id])
    auth_client.post(f"/api/games/{premium.id}/addon-links", json={"ids": [pass_.id], "includedIds": [pass_.id]})

    detail = auth_client.get(f"/api/games/{hot_wheels.uuid}").json()
    assert detail["owned"] is True
    assert [(g["name"], g["category"]) for g in detail["ownedVia"]] == [("Forza Horizon 5: Expansions Bundle", "pack")]

    # Premium lists the pack and, through it, what's inside: Included, not a link of its own.
    addons = {g["name"]: g for g in auth_client.get(f"/api/games/{premium.id}/addons").json()}
    assert set(addons) == {"Forza Horizon 5: Expansions Bundle", "Forza Horizon 5: Hot Wheels"}
    inside = addons["Forza Horizon 5: Hot Wheels"]
    assert (inside["included"], inside["manualLink"], inside["owned"]) == (True, False, True)
    assert inside["includedVia"]["name"] == "Forza Horizon 5: Expansions Bundle"
    assert addons["Forza Horizon 5: Expansions Bundle"]["includedVia"] is None


def test_owning_a_pack_owns_its_nested_contents(auth_client, db_session, seed_platform, season_pass):
    pass_, hot_wheels, ultimate = season_pass["pass"], season_pass["hot_wheels"], season_pass["ultimate"]
    _pack(auth_client, ultimate.id, [pass_.id])
    _pack(auth_client, pass_.id, [hot_wheels.id])
    assert auth_client.get(f"/api/games/{hot_wheels.uuid}").json()["owned"] is False
    db_session.add(
        LibraryItem(
            game_id=ultimate.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED, format=MediaFormat.DIGITAL
        )
    )
    db_session.commit()
    assert auth_client.get(f"/api/games/{hot_wheels.uuid}").json()["owned"] is True
    _lab_off(db_session)
    assert auth_client.get(f"/api/games/{hot_wheels.uuid}").json()["owned"] is False


def test_pack_candidates_are_for_the_same_game_without_loops(auth_client, season_pass):
    pass_, hot_wheels, ultimate = season_pass["pass"], season_pass["hot_wheels"], season_pass["ultimate"]

    def candidates(game_id: int, q: str | None = None) -> list[tuple[str, str, bool]]:
        params = {"q": q} if q else None
        body = auth_client.get(f"/api/games/{game_id}/pack-links/candidates", params=params).json()
        return [(c["name"], c["edition"]["name"], c["linked"]) for c in body]

    _pack(auth_client, pass_.id, [hot_wheels.id])
    # FH5's add-ons, by edition; Rally Adventure (no parent, unlinked) and Zelda's aren't.
    assert candidates(pass_.id) == [
        ("Forza Horizon 5: Car Collection", "Forza Horizon 5", False),
        ("Forza Horizon 5: Hot Wheels", "Forza Horizon 5", True),
        ("Forza Horizon 5: Ultimate Pack", "Forza Horizon 5", False),
    ]
    assert candidates(pass_.id, "Zelda") == []
    # From an add-on: only packs that can hold it (not IGDB's Car Collection).
    assert candidates(hot_wheels.id) == [
        ("Forza Horizon 5: Expansions Bundle", "Forza Horizon 5", True),
        ("Forza Horizon 5: Ultimate Pack", "Forza Horizon 5", False),
    ]
    # The Ultimate Pack holding the pass can't go inside it.
    _pack(auth_client, ultimate.id, [pass_.id])
    assert "Forza Horizon 5: Ultimate Pack" not in [name for name, _, _ in candidates(pass_.id)]


def test_a_wishlisted_pack_wishlists_its_contents_unless_owned(auth_client, db_session, seed_platform, season_pass):
    pass_, hot_wheels, premium = season_pass["pass"], season_pass["hot_wheels"], season_pass["premium"]
    _pack(auth_client, pass_.id, [hot_wheels.id])
    db_session.add(
        LibraryItem(
            game_id=pass_.id, platform_id=seed_platform.id, status=LibraryStatus.WISHLIST, format=MediaFormat.DIGITAL
        )
    )
    db_session.commit()

    detail = auth_client.get(f"/api/games/{hot_wheels.uuid}").json()
    assert (detail["wishlisted"], detail["owned"]) == (True, False)
    assert [g["name"] for g in detail["wishlistedVia"]] == ["Forza Horizon 5: Expansions Bundle"]
    [inside] = auth_client.get(f"/api/games/{pass_.id}/pack-contents").json()
    assert inside["wishlisted"] is True

    # Owned through Premium instead: owned wins.
    auth_client.post(f"/api/games/{premium.id}/addon-links", json={"ids": [pass_.id], "includedIds": [pass_.id]})
    detail = auth_client.get(f"/api/games/{hot_wheels.uuid}").json()
    assert (detail["wishlisted"], detail["owned"], detail["wishlistedVia"]) == (False, True, [])


def test_taking_the_last_holder_away_is_refused(auth_client, season_pass):
    pass_, orphan, premium = season_pass["pass"], season_pass["orphan"], season_pass["premium"]
    url = f"/api/games/{pass_.id}/pack-contents/{orphan.id}"
    assert auth_client.delete(url).status_code == 404
    _pack(auth_client, pass_.id, [orphan.id])
    response = auth_client.delete(url)
    assert (response.status_code, response.json()["detail"]) == (409, "last_link_orphan")
    _link(auth_client, orphan.id, [premium.id])
    assert auth_client.delete(url).status_code == 204
    assert _names(auth_client.get(f"/api/games/{pass_.id}/pack-contents")) == []


def test_deleting_a_game_takes_its_pack_and_the_contents_with_it(auth_client, db_session, season_pass):
    standard, pass_, hot_wheels = season_pass["standard"], season_pass["pass"], season_pass["hot_wheels"]
    pass_id, hot_wheels_id = pass_.id, hot_wheels.id
    _pack(auth_client, pass_.id, [hot_wheels.id])
    # Both go with Standard, so the pass holding Hot Wheels doesn't keep it.
    assert auth_client.get(f"/api/games/{standard.id}/removal-preview").json() == {"keptAddons": []}
    assert auth_client.delete(f"/api/games/{standard.id}").status_code == 204
    db_session.expire_all()
    assert db_session.get(Game, pass_id) is None and db_session.get(Game, hot_wheels_id) is None


def test_deleting_a_game_keeps_contents_of_a_pack_that_stays(auth_client, db_session, season_pass):
    standard, ultimate, hot_wheels, premium = (
        season_pass["standard"],
        season_pass["ultimate"],
        season_pass["hot_wheels"],
        season_pass["premium"],
    )
    # The Ultimate Pack stays (linked to Premium), so Hot Wheels inside it stays too.
    _link(auth_client, ultimate.id, [premium.id])
    _pack(auth_client, ultimate.id, [hot_wheels.id])
    preview = auth_client.get(f"/api/games/{standard.id}/removal-preview").json()
    assert sorted(a["name"] for a in preview["keptAddons"]) == [
        "Forza Horizon 5: Hot Wheels",
        "Forza Horizon 5: Ultimate Pack",
    ]


def test_settings_marks_pack_rows(auth_client, season_pass):
    _pack(auth_client, season_pass["pass"].id, [season_pass["hot_wheels"].id])
    [row] = auth_client.get("/api/addon-links").json()
    assert (row["game"]["name"], row["relation"], row["manual"], row["pack"]) == (
        "Forza Horizon 5: Expansions Bundle",
        "included",
        True,
        True,
    )


@pytest.mark.parametrize(
    ("method", "path"),
    [("get", "pack-contents"), ("get", "packs"), ("get", "pack-links/candidates"), ("delete", "pack-contents/1")],
)
def test_pack_routes_are_404_while_the_lab_is_off(auth_client, db_session, season_pass, method, path):
    _lab_off(db_session)
    assert getattr(auth_client, method)(f"/api/games/{season_pass['pass'].id}/{path}").status_code == 404


def test_an_igdb_pack_holds_nothing(auth_client, season_pass):
    car_pack, hot_wheels = season_pass["car_pack"], season_pass["hot_wheels"]
    # IGDB files single add-ons as Packs, so its Car Collection can't take contents.
    assert _pack(auth_client, car_pack.id, [hot_wheels.id]).status_code == 409
    # From its own page it's an ordinary add-on: the picker offers packs to put it in.
    body = auth_client.get(f"/api/games/{car_pack.id}/pack-links/candidates").json()
    assert [c["name"] for c in body] == ["Forza Horizon 5: Expansions Bundle", "Forza Horizon 5: Ultimate Pack"]
    assert _pack(auth_client, car_pack.id, [season_pass["pass"].id]).json() == {"added": 1}


# --- Pre-order bonuses ----------------------------------------------------------------------


def test_a_pre_order_bonus_is_a_label_and_never_owned(auth_client, db_session, fh5):
    car_pack, premium, standard = fh5["car_pack"], fh5["premium"], fh5["standard"]
    response = auth_client.post(
        f"/api/games/{premium.id}/addon-links", json={"ids": [car_pack.id], "preorderBonusIds": [car_pack.id]}
    )
    assert response.json() == {"added": 1}

    [addon] = auth_client.get(f"/api/games/{premium.id}/addons").json()
    # Premium is owned, but a bonus only counts once you own it yourself.
    assert (addon["preorderBonus"], addon["included"], addon["owned"]) == (True, False, False)
    # Never owned through the game: a copy of the bonus is added by hand, like any copy.
    detail = auth_client.get(f"/api/games/{car_pack.uuid}").json()
    assert (detail["owned"], detail["ownedVia"]) == (False, [])

    # The IGDB parent can carry the mark too.
    url = f"/api/games/{car_pack.id}/addon-links/{standard.id}/relation"
    assert auth_client.put(url, json={"relation": "preorder_bonus"}).status_code == 204
    rows = {row["game"]["name"]: (row["relation"], row["manual"]) for row in auth_client.get("/api/addon-links").json()}
    assert rows == {
        "Forza Horizon 5": ("preorder_bonus", False),
        "Forza Horizon 5: Premium Edition": ("preorder_bonus", True),
    }


def test_relations_are_exclusive(auth_client, db_session, fh5):
    car_pack, premium = fh5["car_pack"], fh5["premium"]
    _link(auth_client, car_pack.id, [premium.id])
    url = f"/api/games/{car_pack.id}/addon-links/{premium.id}/relation"

    auth_client.put(url, json={"relation": "preorder_bonus"})
    auth_client.put(url, json={"relation": "included"})
    link = db_session.query(GameAddonLink).one()
    db_session.refresh(link)
    assert (link.included, link.preorder_bonus) == (True, False)

    auth_client.put(url, json={"relation": "preorder_bonus"})
    db_session.refresh(link)
    assert (link.included, link.preorder_bonus) == (False, True)
    # Asked for both at once, Included wins.
    auth_client.post(
        f"/api/games/{premium.id}/addon-links",
        json={"ids": [car_pack.id], "includedIds": [car_pack.id], "preorderBonusIds": [car_pack.id]},
    )
    db_session.refresh(link)
    assert (link.included, link.preorder_bonus) == (True, False)
    candidates = auth_client.get(f"/api/games/{car_pack.id}/addon-links/candidates").json()
    assert [(c["name"], c["linkedRelation"]) for c in candidates] == [("Forza Horizon 5: Premium Edition", "included")]


def test_backup_round_trips_the_pre_order_bonus(auth_client, fh5):
    car_pack, premium = fh5["car_pack"], fh5["premium"]
    auth_client.post(
        f"/api/games/{premium.id}/addon-links", json={"ids": [car_pack.id], "preorderBonusIds": [car_pack.id]}
    )
    [link] = auth_client.get("/api/export/backup").json()["addon_links"]
    assert (link["included"], link["preorder_bonus"]) == (False, True)


@respx.mock
def test_base_game_add_ons_can_be_linked_as_pre_order_bonuses(auth_client, igdb_client, fh5):
    premium = fh5["premium"]
    _mock_igdb(FH5_IGDB, [_addon_payload(300, "Forza Horizon 5: VIP")])
    url = f"/api/games/{premium.id}/base-game-addons"
    auth_client.post(url, json={"igdbIds": [300], "preorderBonusIgdbIds": [300]})
    [addon] = auth_client.get(f"/api/games/{premium.id}/addons").json()
    assert (addon["name"], addon["preorderBonus"]) == ("Forza Horizon 5: VIP", True)
    body = auth_client.get(f"/api/games/{premium.id}/base-game-addons").json()
    assert [a["relation"] for a in body["addons"]] == ["preorder_bonus"]
