from app.models.catalog import Game, GameCategory


def _get_token(auth_client):
    return auth_client.get("/api/share-link").json()["token"]


def test_public_games_with_valid_token(auth_client, client, seed_game):
    token = _get_token(auth_client)

    response = client.get(f"/api/public/{token}/games")

    assert response.status_code == 200
    body = response.json()
    assert [game["name"] for game in body] == ["Test Game"]
    game = body[0]
    assert set(game.keys()) == {"id", "name", "coverUrl", "category", "firstReleaseDate", "owned", "wishlisted"}


def test_public_games_wrong_token_is_404(client, seed_game):
    response = client.get("/api/public/not-a-real-token/games")

    assert response.status_code == 404


def test_public_games_search_filters_results(auth_client, client, seed_game):
    token = _get_token(auth_client)

    matching = client.get(f"/api/public/{token}/games", params={"search": "Test"})
    nonmatching = client.get(f"/api/public/{token}/games", params={"search": "Nonexistent"})

    assert [game["name"] for game in matching.json()] == ["Test Game"]
    assert nonmatching.json() == []


def test_public_games_sort(auth_client, client, db_session, seed_game):
    seed_game.first_release_date = 1_000_000_000
    db_session.add(
        Game(
            igdb_id=1002,
            name="Another Game",
            slug="another-game",
            category=GameCategory.MAIN_GAME,
            first_release_date=1_500_000_000,
        )
    )
    db_session.commit()
    token = _get_token(auth_client)

    def names(sort=None):
        params = {"sort": sort} if sort else {}
        return [game["name"] for game in client.get(f"/api/public/{token}/games", params=params).json()]

    assert names() == ["Another Game", "Test Game"]
    assert names("name_desc") == ["Test Game", "Another Game"]
    assert names("release_date_asc") == ["Test Game", "Another Game"]
    assert names("release_date_desc") == ["Another Game", "Test Game"]
    assert client.get(f"/api/public/{token}/games", params={"sort": "bogus"}).status_code == 422


def test_public_devices_with_valid_token(auth_client, client, seed_device):
    token = _get_token(auth_client)

    response = client.get(f"/api/public/{token}/devices")

    assert response.status_code == 200
    body = response.json()
    assert [device["officialName"] for device in body] == ["Test Console"]
    device = body[0]
    assert set(device.keys()) == {
        "id",
        "officialName",
        "manufacturerName",
        "hardwarePlatformName",
        "imageUrl",
        "owned",
        "wishlisted",
        "ownedQuantity",
    }


def test_public_devices_wrong_token_is_404(client, seed_device):
    response = client.get("/api/public/not-a-real-token/devices")

    assert response.status_code == 404


def test_public_accessories_with_valid_token(auth_client, client, seed_accessory):
    token = _get_token(auth_client)

    response = client.get(f"/api/public/{token}/accessories")

    assert response.status_code == 200
    body = response.json()
    assert [accessory["officialName"] for accessory in body] == ["Test Controller"]
    accessory = body[0]
    assert set(accessory.keys()) == {
        "id",
        "officialName",
        "manufacturerName",
        "imageUrl",
        "owned",
        "wishlisted",
        "ownedQuantity",
    }


def test_public_accessories_wrong_token_is_404(client, seed_accessory):
    response = client.get("/api/public/not-a-real-token/accessories")

    assert response.status_code == 404


PUBLIC_GAME_DETAIL_KEYS = {
    "id",
    "name",
    "coverUrl",
    "category",
    "firstReleaseDate",
    "owned",
    "wishlisted",
    "igdbId",
    "igdbUrl",
    "summary",
    "storyline",
    "edition",
    "rating",
    "parentGameId",
    "parentGameName",
    "parentGameSlug",
    "parentGameUuid",
    "displayParentGameId",
    "displayParentGameName",
    "displayParentGameSlug",
    "displayParentGameUuid",
    "externalParentName",
    "externalParentIgdbUrl",
    "genres",
    "companies",
    "franchises",
    "collections",
    "platforms",
    "screenshotUrls",
    "artworkUrls",
    "videos",
    "releaseDates",
    "steamStoreUrl",
    "xboxStoreUrl",
    "playstationStoreUrl",
    "nintendoStoreUrl",
    "epicGamesStoreUrl",
    "gogStoreUrl",
}


def test_public_game_detail_returns_about_data_only(auth_client, client, db_session, seed_game):
    seed_game.summary = "A test summary."
    db_session.commit()
    token = _get_token(auth_client)

    response = client.get(f"/api/public/{token}/games/{seed_game.id}")

    assert response.status_code == 200
    body = response.json()
    # Exact key set: nothing private (tags, progress, notes, library copies, sale state) leaks.
    assert set(body.keys()) == PUBLIC_GAME_DETAIL_KEYS
    assert body["name"] == "Test Game"
    assert body["summary"] == "A test summary."
    assert body["rating"] is None


def test_public_game_detail_wrong_token_is_404(client, seed_game):
    response = client.get(f"/api/public/not-a-real-token/games/{seed_game.id}")

    assert response.status_code == 404


def test_public_game_detail_unknown_id_is_404(auth_client, client, seed_game):
    token = _get_token(auth_client)

    assert client.get(f"/api/public/{token}/games/999999").status_code == 404


def test_public_game_detail_hides_games_the_public_list_hides(auth_client, client, db_session, seed_game):
    addon = Game(
        igdb_id=1003, name="Test DLC", slug="test-dlc", category=GameCategory.DLC_ADDON, parent_game_id=seed_game.id
    )
    mod = Game(igdb_id=1004, name="Test Mod", slug="test-mod", category=GameCategory.MOD)
    db_session.add_all([addon, mod])
    db_session.commit()
    token = _get_token(auth_client)

    assert client.get(f"/api/public/{token}/games/{addon.id}").status_code == 404
    assert client.get(f"/api/public/{token}/games/{mod.id}").status_code == 404


def test_public_game_detail_only_links_a_public_display_parent(auth_client, client, db_session, seed_game):
    mod = Game(igdb_id=1004, name="Test Mod", slug="test-mod", category=GameCategory.MOD)
    db_session.add(mod)
    db_session.flush()
    linked = Game(
        igdb_id=1005,
        name="Remaster",
        slug="remaster",
        category=GameCategory.REMASTER,
        display_parent_game_id=seed_game.id,
    )
    unlinked = Game(igdb_id=1006, name="Port", slug="port", category=GameCategory.PORT, display_parent_game_id=mod.id)
    db_session.add_all([linked, unlinked])
    db_session.commit()
    token = _get_token(auth_client)

    linked_body = client.get(f"/api/public/{token}/games/{linked.id}").json()
    unlinked_body = client.get(f"/api/public/{token}/games/{unlinked.id}").json()

    assert linked_body["displayParentGameId"] == seed_game.id
    assert linked_body["displayParentGameName"] == "Test Game"
    assert unlinked_body["displayParentGameId"] is None
    assert unlinked_body["displayParentGameName"] is None
