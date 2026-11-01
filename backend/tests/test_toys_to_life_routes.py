import asyncio
from datetime import date

import pytest

from app.models.catalog import Collection, Franchise, Game, GameCategory, GameCollection, GameFranchise, Platform
from app.models.library import GameTag, LibraryItem, LibraryStatus, MediaFormat, Note, Tag
from app.models.toys_to_life import ToysToLifeCopy, ToysToLifeItem, ToysToLifeNote, ToysToLifeTag
from app.schemas.backup import BackupToysToLifeCopy, BackupToysToLifeItem
from app.services import (
    backup_service,
    danger_zone_service,
    game_service,
    toys_to_life_adoption,
    toys_to_life_image_service,
)
from app.services.danger_zone_service import DangerZoneAction
from app.services.toys_to_life_lines import LINES, get_line
from scripts.import_toys_to_life import import_line
from tests.perf_helpers import count_queries

LINE = "lego-dimensions"


@pytest.fixture()
def lego_dimensions(db_session):
    """The real seed CSV, loaded the way the import script does."""
    import_line(db_session, get_line(LINE))
    db_session.commit()


def _item(db_session, set_number: str) -> ToysToLifeItem:
    db_session.expire_all()
    return db_session.query(ToysToLifeItem).filter_by(line=LINE, set_number=set_number).one()


def test_seed_csv_has_every_pack_with_an_igdb_id(db_session, lego_dimensions):
    items = db_session.query(ToysToLifeItem).filter_by(line=LINE).all()

    assert len(items) == 67
    assert all(item.igdb_id for item in items)
    starter_kits = [item for item in items if item.pack_type == "Starter Pack"]
    assert sorted(item.platform_name for item in starter_kits) == [
        "PlayStation 3",
        "PlayStation 4",
        "Wii U",
        "Xbox 360",
        "Xbox One",
    ]
    # Only starter kits are tied to a platform; every starter kit is the base game on IGDB.
    assert {item.igdb_id for item in starter_kits} == {get_line(LINE).parent_igdb_id}
    assert all(item.platform_name is None for item in items if item.pack_type != "Starter Pack")


def test_reimport_keeps_your_own_state(db_session, lego_dimensions):
    item = _item(db_session, "71203")
    item.user_rating = 8
    db_session.add(ToysToLifeCopy(item_id=item.id, status=LibraryStatus.OWNED))
    db_session.commit()

    import_line(db_session, get_line(LINE))
    db_session.commit()

    item = _item(db_session, "71203")
    assert item.user_rating == 8
    assert item.status is LibraryStatus.OWNED
    assert db_session.query(ToysToLifeItem).count() == 67


def test_toys_to_life_routes_require_auth(client):
    assert client.get("/api/toys-to-life/lines").status_code == 401


def test_list_lines_counts_and_parent_game(auth_client, db_session, lego_dimensions):
    db_session.add(
        Game(
            igdb_id=get_line(LINE).parent_igdb_id,
            name="LEGO Dimensions",
            slug="lego-dimensions",
            category=GameCategory.MAIN_GAME,
        )
    )
    db_session.add(ToysToLifeCopy(item_id=_item(db_session, "71203").id, status=LibraryStatus.OWNED))
    db_session.add(ToysToLifeCopy(item_id=_item(db_session, "71204").id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    lines = auth_client.get("/api/toys-to-life/lines").json()

    assert [line["slug"] for line in lines] == [line.slug for line in LINES]
    lego = lines[0]
    assert (lego["packCount"], lego["ownedCount"], lego["wishlistCount"]) == (67, 1, 1)
    assert lego["parentGame"]["slug"] == "lego-dimensions"


def test_list_lines_without_the_parent_game_in_library(auth_client, lego_dimensions):
    parent = auth_client.get("/api/toys-to-life/lines").json()[0]["parentGame"]

    assert parent["name"] == "LEGO Dimensions"
    assert parent["slug"] is None


def test_list_items_starter_kits_first_and_filters(auth_client, db_session, lego_dimensions):
    items = auth_client.get(f"/api/toys-to-life/lines/{LINE}/items").json()
    assert len(items) == 67
    assert [item["packType"] for item in items[:5]] == ["Starter Pack"] * 5
    assert items[5]["setNumber"] == "71201"

    level_packs = auth_client.get(f"/api/toys-to-life/lines/{LINE}/items", params={"packType": "Level Pack"}).json()
    assert {item["packType"] for item in level_packs} == {"Level Pack"}

    found = auth_client.get(f"/api/toys-to-life/lines/{LINE}/items", params={"search": "chell"}).json()
    assert [item["setNumber"] for item in found] == ["71203"]

    db_session.add(ToysToLifeCopy(item_id=_item(db_session, "71203").id, status=LibraryStatus.OWNED))
    db_session.commit()
    owned = auth_client.get(f"/api/toys-to-life/lines/{LINE}/items", params={"status": "owned"}).json()
    assert [(item["setNumber"], item["owned"], item["wishlisted"]) for item in owned] == [("71203", True, False)]


def test_unknown_line_and_pack_404(auth_client, lego_dimensions):
    assert auth_client.get("/api/toys-to-life/lines/skylanders/items").status_code == 404
    assert auth_client.get(f"/api/toys-to-life/lines/{LINE}/items/99999").status_code == 404


def test_item_detail(auth_client, lego_dimensions):
    detail = auth_client.get(f"/api/toys-to-life/lines/{LINE}/items/71170").json()

    assert detail["name"] == "LEGO Dimensions Starter Pack: PS3"
    assert detail["platformName"] == "PlayStation 3"
    assert detail["lineName"] == "LEGO Dimensions"
    assert detail["igdbUrl"].startswith("https://www.igdb.com/games/")
    assert {d["region"] for d in detail["releaseDates"]} == {"north_america", "europe"}
    assert (detail["owned"], detail["wishlisted"]) == (False, False)
    assert detail["tags"] == []


def test_image_url_resolves_only_when_the_file_exists(auth_client, lego_dimensions, tmp_path, monkeypatch):
    monkeypatch.setattr(toys_to_life_image_service, "TOYS_TO_LIFE_IMAGES_DIR", tmp_path)
    url = f"/api/toys-to-life/lines/{LINE}/items/71203"
    assert auth_client.get(url).json()["imageUrl"] is None

    (tmp_path / LINE).mkdir()
    (tmp_path / LINE / "71203-portal-2-level-pack.png").write_bytes(b"png")

    assert auth_client.get(url).json()["imageUrl"] == f"/static/toys-to-life/{LINE}/71203-portal-2-level-pack.png"


def test_copies_add_move_edit_delete_and_the_packs_status(auth_client, db_session, lego_dimensions):
    item_id = _item(db_session, "71203").id
    detail_url = f"/api/toys-to-life/lines/{LINE}/items/71203"

    def status() -> tuple[bool, bool]:
        detail = auth_client.get(detail_url).json()
        return detail["owned"], detail["wishlisted"]

    wished = auth_client.post(f"/api/toys-to-life/items/{item_id}/copies", json={"status": "wishlist", "price": 9.5})
    assert wished.status_code == 201
    assert wished.json() == {"id": wished.json()["id"], "status": "wishlist", "price": 9.5, "notes": None}
    assert status() == (False, True)

    owned = auth_client.post(
        f"/api/toys-to-life/items/{item_id}/copies", json={"status": "owned", "price": 14.99, "notes": "  Sealed  "}
    ).json()
    assert owned["notes"] == "Sealed"
    # An owned and a wishlisted copy make the pack both, like a game; both copies show on its page.
    assert status() == (True, True)
    both = auth_client.get(f"/api/toys-to-life/lines/{LINE}/items", params={"status": "wishlist"}).json()
    assert [item["setNumber"] for item in both] == ["71203"]
    assert [c["status"] for c in auth_client.get(detail_url).json()["copies"]] == ["wishlist", "owned"]

    # Move to Wishlist sends only the status; the price and notes stay.
    moved = auth_client.put(f"/api/toys-to-life/copies/{owned['id']}", json={"status": "wishlist"}).json()
    assert (moved["status"], moved["price"], moved["notes"]) == ("wishlist", 14.99, "Sealed")
    assert status() == (False, True)
    cleared = auth_client.put(f"/api/toys-to-life/copies/{owned['id']}", json={"price": None, "notes": ""}).json()
    assert (cleared["price"], cleared["notes"]) == (None, None)

    assert (
        auth_client.post(f"/api/toys-to-life/items/{item_id}/copies", json={"status": "owned", "price": -1}).status_code
        == 422
    )
    assert auth_client.delete(f"/api/toys-to-life/copies/{owned['id']}").status_code == 204
    assert auth_client.delete(f"/api/toys-to-life/copies/{wished.json()['id']}").status_code == 204
    assert status() == (False, False)
    assert auth_client.post("/api/toys-to-life/items/999999/copies", json={"status": "owned"}).status_code == 404
    assert auth_client.put("/api/toys-to-life/copies/999999", json={"status": "owned"}).status_code == 404


def test_set_rating_validates_range(auth_client, db_session, lego_dimensions):
    item_id = _item(db_session, "71203").id
    url = f"/api/toys-to-life/items/{item_id}/rating"

    assert auth_client.put(url, json={"rating": 9}).json() == {"rating": 9}
    assert auth_client.put(url, json={"rating": 11}).status_code == 422
    assert auth_client.put(url, json={"rating": None}).json() == {"rating": None}


def test_notes_crud(auth_client, db_session, lego_dimensions):
    item_id = _item(db_session, "71203").id
    created = auth_client.post(f"/api/toys-to-life/items/{item_id}/notes", json={"body": "Missing the turret"})
    assert created.status_code == 201
    note_id = created.json()["id"]

    assert auth_client.put(f"/api/toys-to-life/notes/{note_id}", json={"body": "Complete"}).json()["body"] == "Complete"
    assert [n["body"] for n in auth_client.get(f"/api/toys-to-life/items/{item_id}/notes").json()] == ["Complete"]
    assert auth_client.post(f"/api/toys-to-life/items/{item_id}/notes", json={"body": ""}).status_code == 422
    assert auth_client.delete(f"/api/toys-to-life/notes/{note_id}").status_code == 204
    assert auth_client.get(f"/api/toys-to-life/items/{item_id}/notes").json() == []


def test_tags_attach_detach_and_tag_delete(auth_client, db_session, lego_dimensions):
    item_id = _item(db_session, "71203").id
    tag = Tag(name="Boxed")
    db_session.add(tag)
    db_session.commit()

    attached = auth_client.post(f"/api/toys-to-life/items/{item_id}/tags/{tag.id}").json()
    assert [t["name"] for t in attached] == ["Boxed"]
    assert [t["name"] for t in auth_client.get(f"/api/toys-to-life/lines/{LINE}/items/71203").json()["tags"]] == [
        "Boxed"
    ]
    assert auth_client.delete(f"/api/toys-to-life/items/{item_id}/tags/{tag.id}").json() == []

    auth_client.post(f"/api/toys-to-life/items/{item_id}/tags/{tag.id}")
    assert auth_client.delete(f"/api/tags/{tag.id}").status_code == 204
    assert db_session.query(ToysToLifeTag).count() == 0


def _add_state(db_session) -> int:
    item = _item(db_session, "71203")
    tag = Tag(id=5, name="Boxed")
    item.user_rating = 7
    db_session.add_all(
        [
            tag,
            ToysToLifeCopy(item_id=item.id, status=LibraryStatus.OWNED, price=14.99, notes="Sealed"),
            ToysToLifeCopy(item_id=item.id, status=LibraryStatus.WISHLIST),
            ToysToLifeNote(item_id=item.id, body="Complete"),
            ToysToLifeTag(item_id=item.id, tag_id=5),
        ]
    )
    db_session.commit()
    return item.id


def test_backup_round_trip_keeps_toys_to_life_state(db_session, lego_dimensions):
    _add_state(db_session)
    payload = backup_service.build_backup_payload(db_session)

    [row] = payload.toys_to_life
    assert (row.set_number, row.rating, row.notes, row.tag_ids) == ("71203", 7, ["Complete"], [5])
    assert [(c.status, c.price, c.notes) for c in row.copies] == [("owned", 14.99, "Sealed"), ("wishlist", None, None)]

    # Restoring wipes the state first, then puts back exactly what the backup had.
    _item(db_session, "71204").user_rating = 3
    db_session.commit()
    backup_service.restore_backup(db_session, payload)

    item = _item(db_session, "71203")
    assert item.user_rating == 7
    assert item.status is LibraryStatus.OWNED
    assert [(c.status, c.price, c.notes) for c in item.copies] == [
        (LibraryStatus.OWNED, 14.99, "Sealed"),
        (LibraryStatus.WISHLIST, None, None),
    ]
    assert [n.body for n in db_session.query(ToysToLifeNote).all()] == ["Complete"]
    assert [(t.item_id, t.tag_id) for t in db_session.query(ToysToLifeTag).all()] == [(item.id, 5)]
    assert _item(db_session, "71204").user_rating is None


def test_restore_skips_packs_this_install_does_not_have(db_session, lego_dimensions):
    payload = backup_service.build_backup_payload(db_session)
    payload.toys_to_life = [
        BackupToysToLifeItem(line="skylanders", set_number="1", copies=[BackupToysToLifeCopy(status="owned")]),
        BackupToysToLifeItem(
            line=LINE, set_number="71203", copies=[BackupToysToLifeCopy(status="wishlist")], tag_ids=[42]
        ),
    ]

    backup_service.restore_backup(db_session, payload)

    assert _item(db_session, "71203").status is LibraryStatus.WISHLIST
    assert db_session.query(ToysToLifeCopy).count() == 1
    assert db_session.query(ToysToLifeTag).count() == 0


def test_danger_zone_clears_toys_to_life_state(db_session, lego_dimensions):
    _add_state(db_session)

    danger_zone_service.run(db_session, DangerZoneAction.CLEAR_RATINGS)
    danger_zone_service.run(db_session, DangerZoneAction.CLEAR_NOTES)
    danger_zone_service.run(db_session, DangerZoneAction.CLEAR_TAGS)

    assert _item(db_session, "71203").user_rating is None
    assert db_session.query(ToysToLifeNote).count() == 0
    assert db_session.query(ToysToLifeTag).count() == 0
    assert db_session.query(ToysToLifeCopy).count() == 2

    danger_zone_service.run(db_session, DangerZoneAction.RESET_EVERYTHING, "RESET")

    assert db_session.query(ToysToLifeCopy).count() == 0
    # The packs themselves are reference data and stay.
    assert db_session.query(ToysToLifeItem).count() == 67


def _lego_game(db_session) -> Game:
    game = Game(
        igdb_id=get_line(LINE).parent_igdb_id,
        name="LEGO Dimensions",
        slug="lego-dimensions",
        category=GameCategory.MAIN_GAME,
    )
    db_session.add(game)
    db_session.commit()
    return game


def test_game_section_has_only_the_starter_kits_for_your_platforms(auth_client, db_session, lego_dimensions):
    game = _lego_game(db_session)
    ps4 = Platform(igdb_id=48, name="PlayStation 4", slug="ps4")
    xbox_one = Platform(igdb_id=49, name="Xbox One", slug="xboxone")
    db_session.add_all([ps4, xbox_one])
    db_session.flush()
    db_session.add_all(
        [
            LibraryItem(game_id=game.id, platform_id=ps4.id, status=LibraryStatus.OWNED),
            # Only owned copies count: a wishlisted Xbox One copy brings no starter kit.
            LibraryItem(game_id=game.id, platform_id=xbox_one.id, status=LibraryStatus.WISHLIST),
        ]
    )
    db_session.commit()

    section = auth_client.get(f"/api/toys-to-life/games/{game.id}").json()

    assert (section["line"], section["lineName"]) == (LINE, "LEGO Dimensions")
    starter_kits = [item["setNumber"] for item in section["items"] if item["packType"] == "Starter Pack"]
    assert starter_kits == ["71171"]
    assert len(section["items"]) == 63


def test_game_section_without_owned_copies_has_no_starter_kits(auth_client, db_session, lego_dimensions):
    game = _lego_game(db_session)

    items = auth_client.get(f"/api/toys-to-life/games/{game.id}").json()["items"]

    assert len(items) == 62
    assert all(item["packType"] != "Starter Pack" for item in items)


def test_game_section_is_null_for_other_games_and_404_for_unknown(auth_client, seed_game, lego_dimensions):
    assert auth_client.get(f"/api/toys-to-life/games/{seed_game.id}").json() is None
    assert auth_client.get("/api/toys-to-life/games/999999").status_code == 404


def _pack_addon(db_session, game: Game) -> tuple[Game, Game]:
    """IGDB's add-on row for the Portal 2 pack, and an unrelated add-on of the same game."""
    pack = Game(
        igdb_id=_item(db_session, "71203").igdb_id,
        name="LEGO Dimensions: Portal 2 Level Pack",
        category=GameCategory.DLC_ADDON,
        parent_game_id=game.id,
    )
    other = Game(
        igdb_id=987654, name="LEGO Dimensions: Something Else", category=GameCategory.DLC_ADDON, parent_game_id=game.id
    )
    custom = Game(igdb_id=None, name="My own add-on", category=GameCategory.DLC_ADDON, parent_game_id=game.id)
    db_session.add_all([pack, other, custom])
    db_session.commit()
    return pack, other


def test_pack_rows_are_hidden_from_addons_and_missing_addons(auth_client, db_session, seed_platform, lego_dimensions):
    game = _lego_game(db_session)
    _pack, other = _pack_addon(db_session, game)
    db_session.add(LibraryItem(game_id=game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()

    addons = auth_client.get(f"/api/games/{game.id}/addons").json()
    assert sorted(addon["name"] for addon in addons) == ["LEGO Dimensions: Something Else", "My own add-on"]

    [entry] = auth_client.get("/api/insights/missing-addons").json()
    assert {addon["id"] for addon in entry["missingAddons"]} == {other.id} | {
        addon["id"] for addon in addons if addon["name"] == "My own add-on"
    }
    # Hidden, not deleted.
    assert db_session.query(Game).filter_by(igdb_id=_item(db_session, "71203").igdb_id).count() == 1


class _FakeIgdb:
    def __init__(self, game: dict, addons: list[dict]):
        self.game = game
        self.addons = addons

    async def get_games_by_ids(self, ids):
        return [self.game]

    async def get_addons_by_parent_igdb_id(self, igdb_id):
        return self.addons


def test_importing_the_line_game_skips_its_pack_addons(db_session, lego_dimensions):
    pack_igdb_id = _item(db_session, "71203").igdb_id
    client = _FakeIgdb(
        {"id": get_line(LINE).parent_igdb_id, "name": "LEGO Dimensions", "slug": "lego-dimensions", "category": 0},
        [
            {"id": pack_igdb_id, "name": "LEGO Dimensions: Portal 2 Level Pack", "category": 1},
            {"id": 987654, "name": "LEGO Dimensions: Something Else", "category": 1},
        ],
    )

    asyncio.run(game_service.import_game_from_igdb(db_session, client, get_line(LINE).parent_igdb_id))

    assert db_session.query(Game).filter_by(igdb_id=pack_igdb_id).first() is None
    assert db_session.query(Game).filter_by(igdb_id=987654).one().parent_game_id is not None


def test_pack_rows_are_hidden_from_collection_series_and_platform_addons(auth_client, db_session, lego_dimensions):
    game = _lego_game(db_session)
    pack, other = _pack_addon(db_session, game)
    collection = Collection(igdb_id=5001, name="LEGO Dimensions", slug="lego-dimensions-collection")
    franchise = Franchise(igdb_id=5002, name="LEGO", slug="lego")
    ps4 = Platform(igdb_id=48, name="PlayStation 4", slug="ps4")
    db_session.add_all([collection, franchise, ps4])
    db_session.flush()
    db_session.add_all(
        [
            GameCollection(game_id=game.id, collection_id=collection.id),
            GameFranchise(game_id=game.id, franchise_id=franchise.id),
            # Even a copy of IGDB's pack row on a platform doesn't make it an add-on there.
            LibraryItem(game_id=pack.id, platform_id=ps4.id, status=LibraryStatus.WISHLIST),
            LibraryItem(game_id=other.id, platform_id=ps4.id, status=LibraryStatus.WISHLIST),
        ]
    )
    db_session.commit()

    expected = ["LEGO Dimensions: Something Else", "My own add-on"]
    names = lambda games: sorted(g["name"] for g in games)  # noqa: E731
    assert names(auth_client.get("/api/collections/lego-dimensions-collection").json()["addons"]) == expected
    assert names(auth_client.get("/api/collections/lego-dimensions-collection/addons").json()) == expected
    assert names(auth_client.get("/api/franchises/lego").json()["addons"]) == expected
    assert names(auth_client.get("/api/franchises/lego/addons").json()) == expected
    assert names(auth_client.get("/api/platforms/ps4/addons").json()) == ["LEGO Dimensions: Something Else"]


def test_list_endpoints_run_the_same_queries_however_many_packs_you_own(auth_client, db_session, lego_dimensions):
    """The v2.5.0 rule (see test_query_counts.py): no query per pack. Owning more packs, with
    tags and notes on them, must not add queries."""
    game = _lego_game(db_session)
    items = db_session.query(ToysToLifeItem).order_by(ToysToLifeItem.set_number).all()
    tag = Tag(name="Boxed")
    db_session.add(tag)
    db_session.flush()
    paths = ["/api/toys-to-life/lines", f"/api/toys-to-life/lines/{LINE}/items", f"/api/toys-to-life/games/{game.id}"]

    def counts(owned: list[ToysToLifeItem]) -> list[int]:
        for item in owned:
            db_session.add(ToysToLifeCopy(item_id=item.id, status=LibraryStatus.OWNED))
            db_session.add(ToysToLifeNote(item_id=item.id, body="note"))
            db_session.add(ToysToLifeTag(item_id=item.id, tag_id=tag.id))
        db_session.commit()
        db_session.expire_all()
        result = []
        for path in paths:
            with count_queries(db_session.get_bind()) as queries:
                assert auth_client.get(path).status_code == 200
            result.append(len(queries))
        return result

    assert counts(items[:2]) == counts(items[2:40])


def _seed_old_tracking(db_session) -> tuple[Game, Game, Game]:
    """What a library looked like before Toys to Life: packs tracked as add-ons, and the game's
    own copies standing in for the starter kits."""
    game = _lego_game(db_session)
    ps3 = Platform(igdb_id=9, name="PlayStation 3", slug="ps3")
    ps4 = Platform(igdb_id=48, name="PlayStation 4", slug="ps4")
    xbox_one = Platform(igdb_id=49, name="Xbox One", slug="xboxone")
    tag = Tag(id=7, name="Boxed")
    db_session.add_all([ps3, ps4, xbox_one, tag])
    db_session.flush()
    portal, simpsons = (
        Game(igdb_id=_item(db_session, number).igdb_id, name=name, category=GameCategory.PACK, parent_game_id=game.id)
        for number, name in (("71203", "LEGO Dimensions: Portal 2"), ("71202", "LEGO Dimensions: The Simpsons"))
    )
    portal.user_rating = 9
    db_session.add_all([portal, simpsons])
    db_session.flush()
    db_session.add_all(
        [
            LibraryItem(game_id=game.id, platform_id=ps4.id, status=LibraryStatus.OWNED),
            LibraryItem(game_id=game.id, platform_id=xbox_one.id, status=LibraryStatus.WISHLIST),
            LibraryItem(game_id=game.id, platform_id=ps3.id, status=LibraryStatus.OWNED),
            LibraryItem(
                game_id=portal.id,
                platform_id=ps4.id,
                status=LibraryStatus.OWNED,
                format=MediaFormat.PHYSICAL,
                price=14.99,
                acquired_at=date(2016, 5, 1),
                notes="Still sealed",
            ),
            LibraryItem(game_id=portal.id, platform_id=ps3.id, status=LibraryStatus.WISHLIST),
            LibraryItem(game_id=simpsons.id, platform_id=ps4.id, status=LibraryStatus.WISHLIST),
            Note(game_id=portal.id, body="Turret included"),
            GameTag(game_id=portal.id, tag_id=7),
        ]
    )
    # A kit you already track yourself is left as it is.
    db_session.add(ToysToLifeCopy(item_id=_item(db_session, "71170").id, status=LibraryStatus.WISHLIST))
    db_session.commit()
    return game, portal, simpsons


def _status(db_session, set_number: str):
    item = _item(db_session, set_number)
    return item.status


def _assert_adopted(
    db_session,
    game: Game,
    portal_id: int,
    simpsons_id: int,
    *,
    price: float | None = 14.99,
    ps3_kit=LibraryStatus.WISHLIST,
) -> None:
    portal = _item(db_session, "71203")
    assert _status(db_session, "71203") is LibraryStatus.OWNED
    assert portal.user_rating == 9
    assert [t.tag_id for t in db_session.query(ToysToLifeTag).filter_by(item_id=portal.id)] == [7]
    assert [n.body for n in db_session.query(ToysToLifeNote).filter_by(item_id=portal.id)] == ["Turret included"]
    # Each add-on copy is a pack copy now, keeping its status and price; the rest is its notes.
    assert [(c.status, c.price, c.notes) for c in portal.copies] == [
        (
            LibraryStatus.OWNED,
            price,
            "Moved from the add-on “LEGO Dimensions: Portal 2”: PlayStation 4 · Physical · Acquired 2016-05-01"
            "\nStill sealed",
        ),
        (LibraryStatus.WISHLIST, None, "Moved from the add-on “LEGO Dimensions: Portal 2”: PlayStation 3"),
    ]
    assert _status(db_session, "71202") is LibraryStatus.WISHLIST
    # The add-on rows keep nothing of yours; the game keeps its own copies.
    assert db_session.query(LibraryItem).filter(LibraryItem.game_id.in_([portal_id, simpsons_id])).count() == 0
    assert db_session.query(Note).filter_by(game_id=portal_id).count() == 0
    assert db_session.query(GameTag).filter_by(game_id=portal_id).count() == 0
    assert db_session.get(Game, portal_id).user_rating is None
    assert db_session.query(LibraryItem).filter_by(game_id=game.id).count() == 3
    # Starter kits: PS4 owned, Xbox One wishlisted, PS3 kept as you set it, the rest untouched.
    assert [c.status for c in _item(db_session, "71171").copies] == [LibraryStatus.OWNED]
    assert [c.status for c in _item(db_session, "71172").copies] == [LibraryStatus.WISHLIST]
    assert [c.status for c in _item(db_session, "71170").copies] == [ps3_kit]
    assert _status(db_session, "71173") is None
    assert _status(db_session, "71174") is None


def test_adoption_moves_addon_state_to_the_packs(db_session, lego_dimensions):
    game, portal, simpsons = _seed_old_tracking(db_session)

    result = toys_to_life_adoption.adopt_library_state(db_session)
    db_session.commit()

    assert (result.packs, result.starter_kits) == (2, 2)
    _assert_adopted(db_session, game, portal.id, simpsons.id)
    # Running it again moves nothing more.
    again = toys_to_life_adoption.adopt_library_state(db_session)
    assert (again.packs, again.starter_kits) == (0, 0)
    # Portal 2's two copies, the Simpsons one, the PS3 kit's own, and the PS4 and Xbox One kits.
    assert db_session.query(ToysToLifeCopy).count() == 6
    assert db_session.query(ToysToLifeNote).count() == 1


def test_restoring_an_older_backup_moves_addon_state_to_the_packs(db_session, lego_dimensions):
    game, portal, simpsons = _seed_old_tracking(db_session)
    payload = backup_service.build_backup_payload(db_session)
    payload.version = 4
    payload.toys_to_life = []

    backup_service.restore_backup(db_session, payload)

    # Backups don't carry a library copy's price, so the restored copy has none. A format-4 backup
    # has no pack state either, so the PS3 kit set by hand above is gone and follows the game.
    _assert_adopted(db_session, game, portal.id, simpsons.id, price=None, ps3_kit=LibraryStatus.OWNED)


def test_restoring_a_current_backup_leaves_addon_rows_alone(db_session, lego_dimensions):
    """A format-5 backup already carries the packs' own state; nothing is moved again."""
    _seed_old_tracking(db_session)
    payload = backup_service.build_backup_payload(db_session)

    backup_service.restore_backup(db_session, payload)

    assert _status(db_session, "71203") is None
    assert db_session.query(LibraryItem).count() == 6
