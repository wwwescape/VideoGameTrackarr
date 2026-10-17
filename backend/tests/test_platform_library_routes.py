from app.models.catalog import Game, GameCategory, Platform
from app.models.library import GameTag, LibraryItem, LibraryStatus, MediaFormat, Tag


def _game(db_session, igdb_id, name, category=GameCategory.MAIN_GAME, parent=None):
    game = Game(
        igdb_id=igdb_id,
        name=name,
        slug=name.lower().replace(" ", "-"),
        category=category,
        parent_game_id=parent.id if parent else None,
    )
    db_session.add(game)
    db_session.commit()
    return game


def _copy(db_session, game, platform, status=LibraryStatus.OWNED, media_format=MediaFormat.PHYSICAL, storefront=None):
    db_session.add(
        LibraryItem(
            game_id=game.id, platform_id=platform.id, status=status, format=media_format, digital_storefront=storefront
        )
    )
    db_session.commit()


def _platforms(db_session):
    ps5 = Platform(name="PlayStation 5", slug="ps5", abbreviation="PS5")
    switch = Platform(name="Nintendo Switch", slug="switch", abbreviation="Switch")
    unused = Platform(name="Sega Saturn", slug="saturn")
    db_session.add_all([ps5, switch, unused])
    db_session.commit()
    return ps5, switch, unused


def test_list_library_platforms_requires_auth(client):
    response = client.get("/api/platforms/library")

    assert response.status_code == 401


def test_list_library_platforms_counts_owned_and_wishlisted_games(auth_client, db_session):
    ps5, switch, _unused = _platforms(db_session)
    astro = _game(db_session, 1, "Astro Bot")
    spider = _game(db_session, 2, "Spider-Man 2")
    zelda = _game(db_session, 3, "Zelda")
    _copy(db_session, astro, ps5)
    _copy(db_session, astro, ps5)  # a second copy of the same game still counts once
    _copy(db_session, spider, ps5, LibraryStatus.WISHLIST)
    _copy(db_session, zelda, switch)

    response = auth_client.get("/api/platforms/library")

    assert response.status_code == 200
    by_slug = {entry["slug"]: entry for entry in response.json()}
    assert set(by_slug) == {"ps5", "switch"}
    assert by_slug["ps5"] == {
        "id": ps5.id,
        "name": "PlayStation 5",
        "slug": "ps5",
        "abbreviation": "PS5",
        "format": None,
        "storefront": None,
        "ownedCount": 1,
        "wishlistedCount": 1,
    }
    assert by_slug["switch"]["ownedCount"] == 1
    assert by_slug["switch"]["wishlistedCount"] == 0


def test_list_library_platforms_leaves_out_a_platform_with_only_dlc(auth_client, db_session):
    ps5, switch, _unused = _platforms(db_session)
    base = _game(db_session, 1, "Elden Ring")
    dlc = _game(db_session, 2, "Shadow of the Erdtree", GameCategory.DLC_ADDON, parent=base)
    _copy(db_session, base, ps5)
    _copy(db_session, dlc, switch)

    response = auth_client.get("/api/platforms/library")

    assert [entry["slug"] for entry in response.json()] == ["ps5"]


def test_get_platform_by_slug_or_id(auth_client, db_session):
    ps5, _switch, _unused = _platforms(db_session)
    no_slug = Platform(name="Homebrew")
    db_session.add(no_slug)
    db_session.commit()

    by_slug = auth_client.get("/api/platforms/ps5")
    by_id = auth_client.get(f"/api/platforms/{no_slug.id}")

    assert by_slug.status_code == 200
    assert by_slug.json()["id"] == ps5.id
    assert by_id.status_code == 200
    assert by_id.json()["name"] == "Homebrew"


def test_get_platform_returns_404_for_an_unknown_platform(auth_client):
    assert auth_client.get("/api/platforms/nope").status_code == 404
    assert auth_client.get("/api/platforms/999999").status_code == 404


def test_list_games_required_platform_id_scopes_to_copies_and_ands_with_other_filters(auth_client, db_session):
    ps5, switch, _unused = _platforms(db_session)
    astro = _game(db_session, 1, "Astro Bot")
    spider = _game(db_session, 2, "Spider-Man 2")
    zelda = _game(db_session, 3, "Zelda")
    _copy(db_session, astro, ps5)
    _copy(db_session, spider, ps5, LibraryStatus.WISHLIST)
    _copy(db_session, zelda, switch)
    tag = Tag(name="Favourite")
    db_session.add(tag)
    db_session.commit()
    db_session.add(GameTag(game_id=astro.id, tag_id=tag.id))
    db_session.commit()

    scoped = auth_client.get("/api/games", params={"requiredPlatformId": ps5.id})
    scoped_and_tagged = auth_client.get("/api/games", params={"requiredPlatformId": ps5.id, "tagId": tag.id})

    assert {game["name"] for game in scoped.json()} == {"Astro Bot", "Spider-Man 2"}
    assert [game["name"] for game in scoped_and_tagged.json()] == ["Astro Bot"]


def test_list_platform_addons_returns_addons_with_a_copy_on_that_platform(auth_client, db_session):
    ps5, switch, _unused = _platforms(db_session)
    base = _game(db_session, 1, "Elden Ring")
    ps5_dlc = _game(db_session, 2, "Shadow of the Erdtree", GameCategory.DLC_ADDON, parent=base)
    switch_dlc = _game(db_session, 3, "Colosseum Pack", GameCategory.DLC_ADDON, parent=base)
    _copy(db_session, base, ps5)
    _copy(db_session, ps5_dlc, ps5)
    _copy(db_session, switch_dlc, switch)

    response = auth_client.get("/api/platforms/ps5/addons")
    searched = auth_client.get("/api/platforms/ps5/addons", params={"search": "nothing-matches"})

    assert response.status_code == 200
    assert [addon["name"] for addon in response.json()] == ["Shadow of the Erdtree"]
    assert searched.json() == []


def test_list_platform_addons_returns_404_for_an_unknown_platform(auth_client):
    assert auth_client.get("/api/platforms/nope/addons").status_code == 404


def _pc(db_session):
    pc = Platform(name="PC (Microsoft Windows)", slug="win", abbreviation="PC", igdb_id=6)
    db_session.add(pc)
    db_session.commit()
    return pc


def _seed_pc_library(db_session):
    pc = _pc(db_session)
    portal = _game(db_session, 1, "Portal")
    witcher = _game(db_session, 2, "The Witcher 3")
    doom = _game(db_session, 3, "Doom")
    indie = _game(db_session, 4, "Indie Game")
    _copy(db_session, portal, pc, media_format=MediaFormat.DIGITAL, storefront="Steam")
    _copy(db_session, witcher, pc, media_format=MediaFormat.DIGITAL, storefront="Steam")
    # Owned on Steam, wishlisted on GOG: each storefront card sees only its own copy.
    _copy(db_session, witcher, pc, LibraryStatus.WISHLIST, media_format=MediaFormat.DIGITAL, storefront="GOG")
    _copy(db_session, doom, pc)  # physical
    _copy(db_session, indie, pc, media_format=MediaFormat.DIGITAL, storefront="")  # no storefront set
    return pc


def test_list_library_platforms_splits_pc_by_storefront_and_format(auth_client, db_session):
    _seed_pc_library(db_session)

    entries = auth_client.get("/api/platforms/library").json()

    cards = {
        (entry["format"], entry["storefront"]): (entry["ownedCount"], entry["wishlistedCount"]) for entry in entries
    }
    assert cards == {
        ("digital", None): (1, 0),
        ("digital", "GOG"): (0, 1),
        ("digital", "Steam"): (2, 0),
        ("physical", None): (1, 0),
    }
    assert {entry["slug"] for entry in entries} == {"win"}


def test_list_library_platforms_counts_a_pc_copy_without_a_format_as_other(auth_client, db_session):
    pc = _pc(db_session)
    _copy(db_session, _game(db_session, 1, "Old Game"), pc, media_format=None)
    _copy(db_session, _game(db_session, 2, "Other Game"), pc, media_format=MediaFormat.OTHER)

    [entry] = auth_client.get("/api/platforms/library").json()

    assert (entry["format"], entry["ownedCount"]) == ("other", 2)


def test_list_games_scopes_to_one_pc_storefront_or_format(auth_client, db_session):
    pc = _seed_pc_library(db_session)

    def names(**params):
        response = auth_client.get("/api/games", params={"requiredPlatformId": pc.id, **params})
        return sorted(game["name"] for game in response.json())

    assert names() == ["Doom", "Indie Game", "Portal", "The Witcher 3"]
    assert names(requiredPlatformFormat="digital", requiredPlatformStorefront="Steam") == ["Portal", "The Witcher 3"]
    assert names(requiredPlatformFormat="digital", requiredPlatformStorefront="GOG") == ["The Witcher 3"]
    assert names(requiredPlatformFormat="digital") == ["Indie Game"]
    assert names(requiredPlatformFormat="physical") == ["Doom"]


def test_list_platform_addons_scopes_to_one_pc_storefront(auth_client, db_session):
    pc = _pc(db_session)
    base = _game(db_session, 1, "Fallout 4")
    steam_dlc = _game(db_session, 2, "Far Harbor", GameCategory.DLC_ADDON, parent=base)
    gog_dlc = _game(db_session, 3, "Nuka-World", GameCategory.DLC_ADDON, parent=base)
    _copy(db_session, base, pc, media_format=MediaFormat.DIGITAL, storefront="Steam")
    _copy(db_session, steam_dlc, pc, media_format=MediaFormat.DIGITAL, storefront="Steam")
    _copy(db_session, gog_dlc, pc, media_format=MediaFormat.DIGITAL, storefront="GOG")

    response = auth_client.get(
        "/api/platforms/win/addons", params={"requiredPlatformFormat": "digital", "requiredPlatformStorefront": "Steam"}
    )

    assert [addon["name"] for addon in response.json()] == ["Far Harbor"]
