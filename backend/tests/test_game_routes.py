from datetime import UTC, datetime

from app.models.catalog import Game, GameCategory
from app.models.library import GameProgress, GameTag, LibraryItem, LibraryStatus, Note, PlaySession, Tag


def test_list_games_requires_auth(client):
    response = client.get("/api/games")

    assert response.status_code == 401


def test_list_games_returns_top_level_games_only(auth_client, db_session, seed_game):
    addon = Game(igdb_id=2002, name="Test Game DLC", category=GameCategory.DLC_ADDON, parent_game_id=seed_game.id)
    db_session.add(addon)
    db_session.commit()

    response = auth_client.get("/api/games")

    assert response.status_code == 200
    names = [g["name"] for g in response.json()]
    assert names == ["Test Game"]


def test_list_games_excludes_non_browsable_categories_even_without_a_parent(auth_client, db_session, seed_game):
    # These have no structural parent (e.g. resolved to display_parent_game_id instead, or
    # never had one to begin with) but still aren't something a user browses as "their own
    # game" — a community mod, a seasonal content drop, an update, etc.
    excluded = [
        Game(igdb_id=2100, name="Some Mod", category=GameCategory.MOD),
        Game(igdb_id=2101, name="Some Port", category=GameCategory.PORT),
        Game(igdb_id=2102, name="Some Update", category=GameCategory.UPDATE),
        Game(igdb_id=2103, name="Some Season", category=GameCategory.SEASON),
    ]
    included = [
        Game(igdb_id=2104, name="Some Remaster", category=GameCategory.REMASTER),
        Game(igdb_id=2105, name="Some Standalone Expansion", category=GameCategory.STANDALONE_EXPANSION),
        Game(igdb_id=2106, name="Some Expanded Game", category=GameCategory.EXPANDED_GAME),
        Game(igdb_id=2108, name="Some Bundle", category=GameCategory.BUNDLE),
        Game(igdb_id=2109, name="Some Remake", category=GameCategory.REMAKE),
        Game(igdb_id=2107, name="Uncategorized Game", category=None),
    ]
    db_session.add_all(excluded + included)
    db_session.commit()

    response = auth_client.get("/api/games")

    assert response.status_code == 200
    names = {g["name"] for g in response.json()}
    assert names == {"Test Game", *(g.name for g in included)}


def test_list_games_search_is_case_insensitive_substring(auth_client, db_session, seed_game):
    response = auth_client.get("/api/games", params={"search": "test g"})
    assert [g["id"] for g in response.json()] == [seed_game.id]

    response = auth_client.get("/api/games", params={"search": "TEST G"})
    assert [g["id"] for g in response.json()] == [seed_game.id]

    response = auth_client.get("/api/games", params={"search": "no match"})
    assert response.json() == []


def test_get_game_detail_includes_parent_name(auth_client, db_session, seed_game):
    addon = Game(igdb_id=2002, name="Test Game DLC", category=GameCategory.DLC_ADDON, parent_game_id=seed_game.id)
    db_session.add(addon)
    db_session.commit()

    response = auth_client.get(f"/api/games/{addon.uuid}")

    assert response.status_code == 200
    body = response.json()
    assert body["parentGameId"] == seed_game.id
    assert body["parentGameName"] == "Test Game"
    assert body["parentGameSlug"] == "test-game"
    assert body["category"] == "dlc_addon"


def test_owned_and_wishlisted_are_false_with_no_library_items(auth_client, seed_game):
    list_response = auth_client.get("/api/games")
    detail_response = auth_client.get(f"/api/games/{seed_game.slug}")

    assert list_response.json()[0]["owned"] is False
    assert list_response.json()[0]["wishlisted"] is False
    assert detail_response.json()["owned"] is False
    assert detail_response.json()["wishlisted"] is False


def test_owned_is_computed_fresh_not_stored(auth_client, db_session, seed_game, seed_platform):
    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get(f"/api/games/{seed_game.slug}")
    assert response.json()["owned"] is True
    assert response.json()["wishlisted"] is False

    list_response = auth_client.get("/api/games")
    assert list_response.json()[0]["owned"] is True


def test_wishlisted_true_for_wishlist_item(auth_client, db_session, seed_game):
    db_session.add(LibraryItem(game_id=seed_game.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    response = auth_client.get(f"/api/games/{seed_game.slug}")
    assert response.json()["owned"] is False
    assert response.json()["wishlisted"] is True


def test_addon_owned_status_is_independent_of_parent(auth_client, db_session, seed_game, seed_platform):
    addon = Game(igdb_id=2002, name="Test Game DLC", category=GameCategory.DLC_ADDON, parent_game_id=seed_game.id)
    db_session.add(addon)
    db_session.commit()
    db_session.add(LibraryItem(game_id=addon.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()

    addons_response = auth_client.get(f"/api/games/{seed_game.id}/addons")
    [addon_body] = addons_response.json()
    assert addon_body["owned"] is True

    parent_response = auth_client.get(f"/api/games/{seed_game.slug}")
    assert parent_response.json()["owned"] is False


def test_get_game_detail_404_for_missing_game(auth_client):
    response = auth_client.get("/api/games/999999")

    assert response.status_code == 404


def test_get_game_by_numeric_id_404s(auth_client, seed_game):
    """The whole point of switching to slug/uuid lookup — the old numeric id must not
    resolve, or it'd still be enumerable."""
    response = auth_client.get(f"/api/games/{seed_game.id}")

    assert response.status_code == 404


def test_get_game_by_bare_uuid_resolves_without_a_slug(auth_client, seed_game):
    response = auth_client.get(f"/api/games/{seed_game.uuid}")

    assert response.status_code == 200
    assert response.json()["id"] == seed_game.id


def test_list_addons_404_for_missing_parent(auth_client):
    response = auth_client.get("/api/games/999999/addons")

    assert response.status_code == 404


def test_list_addons_returns_children(auth_client, db_session, seed_game):
    addon = Game(igdb_id=2002, name="Test Game DLC", category=GameCategory.DLC_ADDON, parent_game_id=seed_game.id)
    db_session.add(addon)
    db_session.commit()

    response = auth_client.get(f"/api/games/{seed_game.id}/addons")

    assert response.status_code == 200
    assert [a["name"] for a in response.json()] == ["Test Game DLC"]


def test_delete_game_cascades_to_addons_and_library_items(
    auth_client, db_session, seed_game, seed_platform
):
    addon = Game(igdb_id=2002, name="Test Game DLC", category=GameCategory.DLC_ADDON, parent_game_id=seed_game.id)
    db_session.add(addon)
    db_session.commit()

    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.add(LibraryItem(game_id=addon.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()

    # Captured before the delete — the route commits on this same shared session, which
    # expires these ORM objects, so reading .id off them afterwards would try to reload
    # an already-deleted row and raise ObjectDeletedError.
    game_ids = [seed_game.id, addon.id]

    response = auth_client.delete(f"/api/games/{game_ids[0]}")
    assert response.status_code == 204

    assert db_session.query(Game).filter(Game.id.in_(game_ids)).count() == 0
    assert db_session.query(LibraryItem).filter(LibraryItem.game_id.in_(game_ids)).count() == 0


def test_delete_game_404_for_missing_game(auth_client):
    response = auth_client.delete("/api/games/999999")

    assert response.status_code == 404


def test_delete_game_cascades_to_progress_sessions_notes_and_tags(auth_client, db_session, seed_game):
    db_session.add(GameProgress(game_id=seed_game.id, rating=9))
    db_session.add(PlaySession(game_id=seed_game.id, started_at=datetime(2026, 1, 1, 10, 0, tzinfo=UTC)))
    db_session.add(Note(game_id=seed_game.id, body="note"))
    tag = Tag(name="Cascade Test Tag")
    db_session.add(tag)
    db_session.commit()
    db_session.add(GameTag(game_id=seed_game.id, tag_id=tag.id))
    db_session.commit()

    game_id = seed_game.id
    response = auth_client.delete(f"/api/games/{game_id}")

    assert response.status_code == 204
    assert db_session.query(GameProgress).filter_by(game_id=game_id).count() == 0
    assert db_session.query(PlaySession).filter_by(game_id=game_id).count() == 0
    assert db_session.query(Note).filter_by(game_id=game_id).count() == 0
    assert db_session.query(GameTag).filter_by(game_id=game_id).count() == 0
    # The tag itself (a shared, global record) must survive — only the link is cascaded.
    assert db_session.query(Tag).filter_by(id=tag.id).count() == 1
