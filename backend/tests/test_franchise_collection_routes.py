from app.models.catalog import (
    Collection,
    Franchise,
    Game,
    GameCategory,
    GameCollection,
    GameFranchise,
)
from app.models.library import LibraryItem, LibraryStatus


def test_list_franchises_requires_auth(client):
    response = client.get("/api/franchises")

    assert response.status_code == 401


def test_list_franchises_returns_only_franchises_with_local_games(auth_client, db_session, seed_game):
    franchise = Franchise(igdb_id=979, name="The Sims", slug="the-sims")
    empty_franchise = Franchise(igdb_id=980, name="Nothing Synced Here")
    db_session.add_all([franchise, empty_franchise])
    db_session.commit()
    db_session.add(GameFranchise(game_id=seed_game.id, franchise_id=franchise.id))
    db_session.commit()

    response = auth_client.get("/api/franchises")

    assert response.status_code == 200
    [entry] = response.json()
    assert entry["name"] == "The Sims"
    assert entry["gameCount"] == 1


def test_get_franchise_requires_auth(client):
    response = client.get("/api/franchises/1")

    assert response.status_code == 401


def test_get_franchise_404_for_missing(auth_client):
    response = auth_client.get("/api/franchises/does-not-exist")

    assert response.status_code == 404


def test_get_franchise_by_numeric_id_404s(auth_client, db_session):
    """The whole point of switching to slug-based lookup — the old numeric id must not
    resolve, or it'd still be enumerable."""
    franchise = Franchise(igdb_id=979, name="The Sims", slug="the-sims")
    db_session.add(franchise)
    db_session.commit()

    response = auth_client.get(f"/api/franchises/{franchise.id}")

    assert response.status_code == 404


def test_get_franchise_returns_locally_known_games(auth_client, db_session, seed_game, seed_platform):
    franchise = Franchise(igdb_id=979, name="The Sims", slug="the-sims")
    db_session.add(franchise)
    db_session.commit()
    db_session.add(GameFranchise(game_id=seed_game.id, franchise_id=franchise.id))
    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get(f"/api/franchises/{franchise.slug}")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "The Sims"
    [game] = body["games"]
    assert game["id"] == seed_game.id
    assert game["owned"] is True


def test_get_franchise_excludes_games_not_in_it(auth_client, db_session, seed_game):
    other_game = Game(igdb_id=5005, name="Unrelated Game", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    franchise = Franchise(igdb_id=979, name="The Sims", slug="the-sims")
    db_session.add(franchise)
    db_session.commit()
    db_session.add(GameFranchise(game_id=seed_game.id, franchise_id=franchise.id))
    db_session.commit()

    response = auth_client.get(f"/api/franchises/{franchise.slug}")

    [game] = response.json()["games"]
    assert game["id"] == seed_game.id


def test_list_collections_requires_auth(client):
    response = client.get("/api/collections")

    assert response.status_code == 401


def test_list_collections_returns_only_collections_with_local_games(auth_client, db_session, seed_game):
    collection = Collection(igdb_id=61, name="The Sims Collection", slug="the-sims-collection")
    empty_collection = Collection(igdb_id=62, name="Nothing Synced Here")
    db_session.add_all([collection, empty_collection])
    db_session.commit()
    db_session.add(GameCollection(game_id=seed_game.id, collection_id=collection.id))
    db_session.commit()

    response = auth_client.get("/api/collections")

    assert response.status_code == 200
    [entry] = response.json()
    assert entry["name"] == "The Sims Collection"
    assert entry["gameCount"] == 1


def test_get_collection_requires_auth(client):
    response = client.get("/api/collections/1")

    assert response.status_code == 401


def test_get_collection_404_for_missing(auth_client):
    response = auth_client.get("/api/collections/does-not-exist")

    assert response.status_code == 404


def test_get_collection_by_numeric_id_404s(auth_client, db_session):
    """The whole point of switching to slug-based lookup — the old numeric id must not
    resolve, or it'd still be enumerable."""
    collection = Collection(igdb_id=61, name="The Sims Collection", slug="the-sims-collection")
    db_session.add(collection)
    db_session.commit()

    response = auth_client.get(f"/api/collections/{collection.id}")

    assert response.status_code == 404


def test_get_collection_returns_locally_known_games(auth_client, db_session, seed_game):
    collection = Collection(igdb_id=61, name="The Sims Collection", slug="the-sims-collection")
    db_session.add(collection)
    db_session.commit()
    db_session.add(GameCollection(game_id=seed_game.id, collection_id=collection.id))
    db_session.commit()

    response = auth_client.get(f"/api/collections/{collection.slug}")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "The Sims Collection"
    [game] = body["games"]
    assert game["id"] == seed_game.id


def test_get_franchise_excludes_addons_from_the_game_list(auth_client, db_session, seed_game):
    """A DLC/expansion/pack that happens to share a franchise with its parent game must not
    clutter the franchise's Details page — it's still reachable via the parent's own Addons
    tab. Regression test for the same _is_browsable_game/parent_game_id filter the main
    Games list already applies."""
    addon = Game(
        igdb_id=5006,
        name="Test Game: Some DLC",
        category=GameCategory.DLC_ADDON,
        parent_game_id=seed_game.id,
    )
    non_hierarchical_excluded = Game(igdb_id=5007, name="Test Game Mod", category=GameCategory.MOD)
    db_session.add_all([addon, non_hierarchical_excluded])
    franchise = Franchise(igdb_id=979, name="The Sims", slug="the-sims")
    db_session.add(franchise)
    db_session.commit()
    db_session.add(GameFranchise(game_id=seed_game.id, franchise_id=franchise.id))
    db_session.add(GameFranchise(game_id=addon.id, franchise_id=franchise.id))
    db_session.add(GameFranchise(game_id=non_hierarchical_excluded.id, franchise_id=franchise.id))
    db_session.commit()

    list_response = auth_client.get("/api/franchises")
    detail_response = auth_client.get(f"/api/franchises/{franchise.slug}")

    assert list_response.json()[0]["gameCount"] == 1  # the addon and the mod don't count either
    [game] = detail_response.json()["games"]
    assert game["id"] == seed_game.id


def test_get_collection_excludes_addons_from_the_game_list(auth_client, db_session, seed_game):
    """Same regression as the franchise equivalent above, for collections."""
    addon = Game(
        igdb_id=5008,
        name="Test Game: Some Expansion",
        category=GameCategory.EXPANSION,
        parent_game_id=seed_game.id,
    )
    db_session.add(addon)
    collection = Collection(igdb_id=61, name="The Sims Collection", slug="the-sims-collection")
    db_session.add(collection)
    db_session.commit()
    db_session.add(GameCollection(game_id=seed_game.id, collection_id=collection.id))
    db_session.add(GameCollection(game_id=addon.id, collection_id=collection.id))
    db_session.commit()

    list_response = auth_client.get("/api/collections")
    detail_response = auth_client.get(f"/api/collections/{collection.slug}")

    assert list_response.json()[0]["gameCount"] == 1
    [game] = detail_response.json()["games"]
    assert game["id"] == seed_game.id


def test_collection_with_only_addon_members_is_excluded_entirely(auth_client, db_session, seed_game):
    """A collection whose only locally-known members are addons must not appear on the index
    at all — a non-zero game_count that leads to an empty Details page would be worse than
    just not listing it."""
    addon = Game(
        igdb_id=5009,
        name="Test Game: Some Pack",
        category=GameCategory.PACK,
        parent_game_id=seed_game.id,
    )
    db_session.add(addon)
    collection = Collection(igdb_id=63, name="Addon Only Collection", slug="addon-only-collection")
    db_session.add(collection)
    db_session.commit()
    db_session.add(GameCollection(game_id=addon.id, collection_id=collection.id))
    db_session.commit()

    response = auth_client.get("/api/collections")

    assert response.json() == []


def test_game_can_belong_to_multiple_collections(auth_client, db_session, seed_game):
    """The whole reason this is a many-to-many junction table and not a single FK on
    Game — verified against the real IGDB API while building this (M8)."""
    collection_a = Collection(igdb_id=61, name="Collection A")
    collection_b = Collection(igdb_id=62, name="Collection B")
    db_session.add_all([collection_a, collection_b])
    db_session.commit()
    db_session.add(GameCollection(game_id=seed_game.id, collection_id=collection_a.id))
    db_session.add(GameCollection(game_id=seed_game.id, collection_id=collection_b.id))
    db_session.commit()

    response = auth_client.get(f"/api/games/{seed_game.slug}")

    names = {c["name"] for c in response.json()["collections"]}
    assert names == {"Collection A", "Collection B"}
