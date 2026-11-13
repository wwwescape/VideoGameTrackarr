"""Game Shelf: GET /api/games/shelf, one case per (game x platform) you own a physical copy on,
for platforms with a shown standard case."""

import pytest

from app.models.catalog import Game, GameCategory, Platform
from app.models.game_cases import GameCase
from app.models.library import GameTag, LibraryItem, LibraryStatus, MediaFormat, Tag


@pytest.fixture()
def platforms(db_session, game_shelf_lab):
    rows = {
        "ps4": Platform(name="PlayStation 4", slug="ps4", igdb_id=48),
        "ps5": Platform(name="PlayStation 5", slug="ps5", igdb_id=167),
        "pc": Platform(name="PC (Microsoft Windows)", slug="win", igdb_id=6),
        "nes": Platform(name="Nintendo Entertainment System", slug="nes", igdb_id=18),
    }
    db_session.add_all(rows.values())
    db_session.commit()
    return rows


def _game(db_session, name: str, **fields) -> Game:
    game = Game(name=name, category=fields.pop("category", GameCategory.MAIN_GAME), **fields)
    db_session.add(game)
    db_session.flush()
    return game


def _copy(db_session, game: Game, platform: Platform | None, fmt=MediaFormat.PHYSICAL, **fields) -> None:
    db_session.add(
        LibraryItem(
            game_id=game.id,
            platform_id=platform.id if platform else None,
            status=fields.pop("status", LibraryStatus.OWNED),
            format=fmt,
            **fields,
        )
    )
    db_session.commit()


def _cases(client, **params) -> list[tuple[str, str]]:
    response = client.get("/api/games/shelf", params=params)
    assert response.status_code == 200, response.text
    body = response.json()
    names = {platform["id"]: platform["name"] for platform in body["platforms"]}
    return [(case["name"], names[case["platformId"]]) for case in body["cases"]]


def test_shelf_requires_auth(client):
    assert client.get("/api/games/shelf").status_code == 401


def test_one_case_per_platform_you_own_a_physical_copy_on(auth_client, db_session, platforms):
    game = _game(db_session, "Elden Ring", slug="elden-ring")
    _copy(db_session, game, platforms["ps4"])
    _copy(db_session, game, platforms["ps5"])
    # A second physical copy on PS5 (another edition) is still one case.
    _copy(db_session, game, platforms["ps5"], steelbook=True)

    body = auth_client.get("/api/games/shelf").json()

    assert body["cases"] == [
        {"gameId": game.id, "uuid": game.uuid, "slug": "elden-ring", "name": "Elden Ring", "platformId": pid}
        for pid in (platforms["ps4"].id, platforms["ps5"].id)
    ]


def test_only_physical_owned_copies_on_case_platforms(auth_client, db_session, platforms):
    _copy(db_session, _game(db_session, "Physical"), platforms["ps5"])
    _copy(db_session, _game(db_session, "Digital"), platforms["ps5"], MediaFormat.DIGITAL)
    _copy(db_session, _game(db_session, "No Format"), platforms["ps5"], None)
    _copy(db_session, _game(db_session, "Wished"), platforms["ps5"], status=LibraryStatus.WISHLIST)
    _copy(db_session, _game(db_session, "PC Box"), platforms["pc"])
    _copy(db_session, _game(db_session, "NES Cart"), platforms["nes"])
    _copy(db_session, _game(db_session, "No Platform"), None)
    owned = _game(db_session, "Base")
    _copy(db_session, owned, platforms["ps5"])
    _copy(
        db_session,
        _game(db_session, "Base DLC", category=GameCategory.DLC_ADDON, parent_game_id=owned.id),
        platforms["ps5"],
    )
    # Physical on PS4, digital on PS5: only the PS4 case.
    mixed = _game(db_session, "Mixed")
    _copy(db_session, mixed, platforms["ps4"])
    _copy(db_session, mixed, platforms["ps5"], MediaFormat.DIGITAL)

    assert _cases(auth_client) == [
        ("Base", "PlayStation 5"),
        ("Mixed", "PlayStation 4"),
        ("PC Box", "PC (Microsoft Windows)"),
        ("Physical", "PlayStation 5"),
    ]


def test_a_hidden_case_takes_its_platform_off_the_shelf(auth_client, db_session, platforms):
    _copy(db_session, _game(db_session, "On PS4"), platforms["ps4"])
    _copy(db_session, _game(db_session, "On PS5"), platforms["ps5"])
    db_session.query(GameCase).filter_by(platform_slug="ps4").update({GameCase.shown: False})
    db_session.commit()

    assert _cases(auth_client) == [("On PS5", "PlayStation 5")]


def test_a_suffixed_igdb_slug_shares_the_case(auth_client, db_session, platforms):
    alt = Platform(name="PlayStation 4 (alt)", slug="ps4--1", igdb_id=4801)
    db_session.add(alt)
    db_session.commit()
    _copy(db_session, _game(db_session, "Alt"), alt)

    assert _cases(auth_client) == [("Alt", "PlayStation 4 (alt)")]


def test_platforms_carry_their_case_look(auth_client, db_session, platforms):
    platforms["ps5"].logo_url = "https://images.igdb.com/ps5.png"
    platforms["ps5"].abbreviation = "PS5"
    _copy(db_session, _game(db_session, "A"), platforms["ps5"])

    body = auth_client.get("/api/games/shelf").json()

    assert body["platforms"] == [
        {
            "id": platforms["ps5"].id,
            "name": "PlayStation 5",
            "slug": "ps5",
            "abbreviation": "PS5",
            "logoUrl": "https://images.igdb.com/ps5.png",
            "case": {
                "platformSlug": "ps5",
                "caseLabel": "Blu-ray case",
                "heightMm": 171.0,
                "spineMm": 12.0,
                "caseTopMm": 6.0,
                "caseColor": "#1a3d8f",
                "logoBandColor": "#ffffff",
                "logoBandHeightPct": 25.0,
                "logo": "ps5.png",
                "logoColor": None,
                "logoLineColor": "#1f5fc8",
                "titleBandColor": "#ffffff",
                "titleTextColor": "#111111",
            },
        }
    ]


def test_platform_filter_narrows_cases_not_just_games(auth_client, db_session, platforms):
    game = _game(db_session, "Both")
    _copy(db_session, game, platforms["ps4"])
    _copy(db_session, game, platforms["ps5"])
    _copy(db_session, _game(db_session, "PS4 Only"), platforms["ps4"])

    assert _cases(auth_client, platformId=platforms["ps5"].id) == [("Both", "PlayStation 5")]
    assert _cases(auth_client, platformId=platforms["ps5"].id, platformExclude="true") == [
        ("Both", "PlayStation 4"),
        ("PS4 Only", "PlayStation 4"),
    ]


def test_platform_card_filter_narrows_cases_like_a_platform_id(auth_client, db_session, platforms):
    # The Filter dialog sends Platforms-page cards (platformScope), not plain ids.
    game = _game(db_session, "Both")
    _copy(db_session, game, platforms["ps4"])
    _copy(db_session, game, platforms["ps5"])
    _copy(db_session, _game(db_session, "PS4 Only"), platforms["ps4"])
    ps5 = str(platforms["ps5"].id)

    assert _cases(auth_client, platformScope=ps5) == [("Both", "PlayStation 5")]
    # "Not PS5" drops only the PS5 cases, not every game with one.
    assert _cases(auth_client, platformScope=ps5, platformExclude="true") == [
        ("Both", "PlayStation 4"),
        ("PS4 Only", "PlayStation 4"),
    ]
    # A card for another format has no physical cases.
    assert _cases(auth_client, platformScope=f"{ps5}:digital:") == []


def test_steelbook_filter_narrows_cases_and_format_filters_dont_apply(auth_client, db_session, platforms):
    game = _game(db_session, "Steel")
    _copy(db_session, game, platforms["ps4"], steelbook=True)
    _copy(db_session, game, platforms["ps5"])

    assert _cases(auth_client, steelbookOnly="true") == [("Steel", "PlayStation 4")]
    # Everything on the shelf is physical: a format or storefront filter changes nothing.
    assert _cases(auth_client, format="digital") == [("Steel", "PlayStation 4"), ("Steel", "PlayStation 5")]
    assert _cases(auth_client, storefront="Steam") == [("Steel", "PlayStation 4"), ("Steel", "PlayStation 5")]


def test_game_level_filters_and_search(auth_client, db_session, platforms):
    tagged = _game(db_session, "Tagged Game")
    _copy(db_session, tagged, platforms["ps5"])
    _copy(db_session, _game(db_session, "Other Game"), platforms["ps5"])
    tag = Tag(name="Favourite")
    db_session.add(tag)
    db_session.flush()
    db_session.add(GameTag(game_id=tagged.id, tag_id=tag.id))
    db_session.commit()

    assert _cases(auth_client, tagId=tag.id) == [("Tagged Game", "PlayStation 5")]
    assert _cases(auth_client, search="other") == [("Other Game", "PlayStation 5")]


def test_sorts_games_and_falls_back_to_name_for_labels(auth_client, db_session, platforms):
    for name, released in (("Bravo", 300), ("Alpha", 100), ("Charlie", 200)):
        _copy(db_session, _game(db_session, name, first_release_date=released), platforms["ps5"])

    def names(**params):
        return [name for name, _ in _cases(auth_client, **params)]

    assert names() == ["Alpha", "Bravo", "Charlie"]
    assert names(sort="name_desc") == ["Charlie", "Bravo", "Alpha"]
    assert names(sort="release_date_desc") == ["Bravo", "Charlie", "Alpha"]
    assert names(sort="labels_asc") == ["Alpha", "Bravo", "Charlie"]


def test_empty_shelf(auth_client, game_shelf_lab):
    assert auth_client.get("/api/games/shelf").json() == {"cases": [], "platforms": []}


def test_the_platforms_sort_groups_cases_by_platform(auth_client, db_session, platforms):
    """Platforms mix on the shelf by default; the Platforms sort lines them up by platform."""
    for name, platform in (("Alpha", "ps5"), ("Bravo", "ps4"), ("Charlie", "ps5"), ("Delta", "ps4")):
        _copy(db_session, _game(db_session, name), platforms[platform])

    assert _cases(auth_client) == [
        ("Alpha", "PlayStation 5"),
        ("Bravo", "PlayStation 4"),
        ("Charlie", "PlayStation 5"),
        ("Delta", "PlayStation 4"),
    ]
    assert _cases(auth_client, sort="platforms_asc") == [
        ("Bravo", "PlayStation 4"),
        ("Delta", "PlayStation 4"),
        ("Alpha", "PlayStation 5"),
        ("Charlie", "PlayStation 5"),
    ]

    # A game on both platforms has a case in each platform's run, games A-Z within either way.
    both = _game(db_session, "Echo")
    _copy(db_session, both, platforms["ps4"])
    _copy(db_session, both, platforms["ps5"])
    assert _cases(auth_client, sort="platforms_desc") == [
        ("Alpha", "PlayStation 5"),
        ("Charlie", "PlayStation 5"),
        ("Echo", "PlayStation 5"),
        ("Bravo", "PlayStation 4"),
        ("Delta", "PlayStation 4"),
        ("Echo", "PlayStation 4"),
    ]
