"""Manual add-on links: an add-on linked to more games than its IGDB parent, from either side,
without ever touching IGDB's own link (parent_game_id)."""

import io
import json
import time

import httpx
import pytest
import respx

from app.models.catalog import Collection, Franchise, Game, GameAddonLink, GameCategory, GameCollection, GameFranchise
from app.models.labs import LAB_LINKED_ADDONS, LabFeature
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.services import game_service
from app.services.igdb_client import IGDB_API_BASE, IGDB_TOKEN_URL


@pytest.fixture(autouse=True)
def linked_addons_lab(db_session):
    """The Linked Add-ons lab on; the lab-off tests below turn it off again."""
    db_session.add(LabFeature(id=LAB_LINKED_ADDONS, enabled=True))
    db_session.commit()


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

    standard = Game(name="Forza Horizon 5", category=GameCategory.MAIN_GAME, igdb_id=100)
    premium = Game(name="Forza Horizon 5: Premium Edition", category=GameCategory.BUNDLE, igdb_id=171270)
    motorsport = Game(name="Forza Motorsport", category=GameCategory.MAIN_GAME, igdb_id=101)
    zelda = Game(name="Zelda", category=GameCategory.MAIN_GAME, igdb_id=102)
    db_session.add_all([standard, premium, motorsport, zelda])
    db_session.flush()
    car_pack = Game(
        name="Forza Horizon 5: Car Collection", category=GameCategory.PACK, igdb_id=200, parent_game_id=standard.id
    )
    zelda_dlc = Game(name="Zelda DLC", category=GameCategory.DLC_ADDON, igdb_id=201, parent_game_id=zelda.id)
    orphan = Game(name="Forza Horizon 5: Rally Adventure", category=GameCategory.EXPANSION, igdb_id=202)
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


def test_candidates_for_an_add_on_come_from_its_parents_family(auth_client, fh5):
    car_pack = fh5["car_pack"]
    _link(auth_client, car_pack.id, [fh5["premium"].id])
    body = auth_client.get(f"/api/games/{car_pack.id}/addon-links/candidates").json()
    # The car pack has no Collection of its own: its parent's count. The parent itself, add-ons
    # and Zelda are left out; Collection matches come before Franchise-only ones.
    assert [(c["name"], c["sameCollection"], c["linked"]) for c in body] == [
        ("Forza Horizon 5: Premium Edition", True, True),
        ("Forza Motorsport", False, False),
    ]


def test_candidates_for_a_game_are_add_ons_from_its_family(auth_client, fh5):
    body = auth_client.get(f"/api/games/{fh5['premium'].id}/addon-links/candidates").json()
    assert [(c["name"], c["sameCollection"]) for c in body] == [
        ("Forza Horizon 5: Car Collection", True),
        ("Forza Horizon 5: Rally Adventure", True),
    ]
    searched = auth_client.get(f"/api/games/{fh5['premium'].id}/addon-links/candidates", params={"q": "rally"})
    assert _names(searched) == ["Forza Horizon 5: Rally Adventure"]
    # A game's own IGDB add-ons aren't offered.
    assert _names(auth_client.get(f"/api/games/{fh5['standard'].id}/addon-links/candidates")) == [
        "Forza Horizon 5: Rally Adventure"
    ]


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
    assert body["version"] == 10
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
def test_no_base_game_on_igdb_offers_nothing(auth_client, igdb_client, fh5):
    _mock_igdb(None, [])
    assert auth_client.get(f"/api/games/{fh5['premium'].id}/base-game-addons").json() == {
        "baseGame": None,
        "addons": [],
    }


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
