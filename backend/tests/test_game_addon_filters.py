"""The Games list's Include add-ons: search and filters can be met by a game's add-ons, with the
results flagged matchedViaAddon when only an add-on matched (the card's "Via add-on" chip)."""

import pytest

from app.models.catalog import Game, GameCategory, Platform
from app.models.library import GameTag, LibraryItem, LibraryStatus, MediaFormat, Tag


@pytest.fixture()
def library(db_session):
    ps5 = Platform(name="PlayStation 5", slug="ps5", igdb_id=167)
    switch = Platform(name="Nintendo Switch", slug="switch", igdb_id=130)
    coop = Tag(name="Co-op")
    favourite = Tag(name="Favourite")
    db_session.add_all([ps5, switch, coop, favourite])
    db_session.flush()

    elden = Game(name="Elden Ring", category=GameCategory.MAIN_GAME, igdb_id=119133)
    zelda = Game(name="Zelda: Tears of the Kingdom", category=GameCategory.MAIN_GAME, igdb_id=119388)
    db_session.add_all([elden, zelda])
    db_session.flush()
    erdtree = Game(
        name="Elden Ring: Shadow of the Erdtree",
        category=GameCategory.DLC_ADDON,
        igdb_id=250616,
        parent_game_id=elden.id,
    )
    db_session.add(erdtree)
    db_session.flush()

    # The base game is owned on PS5; the add-on has no copy of its own but carries a tag.
    owned = LibraryStatus.OWNED
    db_session.add(LibraryItem(game_id=elden.id, platform_id=ps5.id, status=owned, format=MediaFormat.DIGITAL))
    db_session.add(LibraryItem(game_id=zelda.id, platform_id=switch.id, status=owned, format=MediaFormat.PHYSICAL))
    db_session.add(GameTag(game_id=erdtree.id, tag_id=coop.id))
    db_session.add(GameTag(game_id=elden.id, tag_id=favourite.id))
    db_session.commit()
    return {"ps5": ps5, "switch": switch, "coop": coop, "favourite": favourite, "elden": elden, "erdtree": erdtree}


def _games(client, **params) -> dict[str, bool]:
    response = client.get("/api/games", params=params)
    assert response.status_code == 200, response.text
    return {game["name"]: game["matchedViaAddon"] for game in response.json()}


def test_off_by_default_add_ons_are_not_searched(auth_client, library):
    assert _games(auth_client, search="Erdtree") == {}
    assert _games(auth_client, tagId=library["coop"].id) == {}


def test_a_search_can_match_an_add_on(auth_client, library):
    assert _games(auth_client, search="Erdtree", includeAddons=True) == {"Elden Ring": True}


def test_a_game_that_matches_by_itself_is_not_flagged(auth_client, library):
    # "Elden" matches the base game's own name (and the add-on's): no chip.
    assert _games(auth_client, search="Elden", includeAddons=True) == {"Elden Ring": False}
    # And without any filter nothing is flagged.
    assert set(_games(auth_client, includeAddons=True).values()) == {False}


def test_each_condition_can_be_met_by_a_different_item(auth_client, library):
    # The search matches the add-on's name; PS5 is met by the base game's own copy.
    assert _games(auth_client, search="Erdtree", platformId=library["ps5"].id, includeAddons=True) == {
        "Elden Ring": True
    }
    # Nothing on Switch has an Erdtree.
    assert _games(auth_client, search="Erdtree", platformId=library["switch"].id, includeAddons=True) == {}


def test_match_all_lets_each_value_come_from_a_different_item(auth_client, library):
    tags = [library["coop"].id, library["favourite"].id]
    # Favourite is on the base game, Co-op on its add-on.
    assert _games(auth_client, tagId=tags, tagMatchAll=True) == {}
    assert _games(auth_client, tagId=tags, tagMatchAll=True, includeAddons=True) == {"Elden Ring": True}


def test_excludes_stay_on_the_game(auth_client, library):
    # "Not Co-op": only the add-on is tagged Co-op, so Elden Ring stays listed, unflagged.
    listed = _games(auth_client, tagId=library["coop"].id, tagExclude=True, includeAddons=True)
    assert listed == {"Elden Ring": False, "Zelda: Tears of the Kingdom": False}


def test_game_type_stays_on_the_game(auth_client, library):
    # Asking for DLC never lists a base game because its add-on is one.
    assert _games(auth_client, category="dlc_addon", includeAddons=True) == {}
    assert _games(auth_client, category="main_game", search="Erdtree", includeAddons=True) == {"Elden Ring": True}


def test_other_lists_ignore_it(auth_client, library, db_session):
    # The Game Shelf takes the same filters; Include add-ons there changes nothing it shows.
    from app.models.labs import LabFeature

    db_session.add(LabFeature(id="game_shelf", enabled=True))
    db_session.commit()
    assert auth_client.get("/api/games/shelf", params={"includeAddons": True}).status_code == 200


def test_library_filters_with_add_ons(auth_client, db_session, library):
    """#55's filters under Include add-ons: a genre can come from an add-on, like tags, while
    release, rating and players describe the game itself and stay on it."""
    from app.models.catalog import GameGenre, Genre

    elden, erdtree = library["elden"], library["erdtree"]
    soulslike = Genre(name="Soulslike", igdb_id=990001)
    db_session.add(soulslike)
    db_session.flush()
    db_session.add(GameGenre(game_id=erdtree.id, genre_id=soulslike.id))
    # Only the add-on is "out in 2024", rated 9.5 and for 4 players.
    elden.first_release_date, erdtree.first_release_date = 1645747200, 1718928000  # 2022, 2024
    elden.igdb_rating, erdtree.igdb_rating = 70.0, 95.0
    elden.local_players, erdtree.local_players = 1, 4
    db_session.commit()

    assert _games(auth_client, genreId=soulslike.id) == {}
    assert _games(auth_client, genreId=soulslike.id, includeAddons=True) == {"Elden Ring": True}

    for params in ({"releaseYearFrom": 2024}, {"ratingMin": 90}, {"localPlayersMin": 4}):
        assert _games(auth_client, includeAddons=True, **params) == {}, params
