"""Per-game public visibility (hide_from_public): the private PATCH/bulk endpoints
and the public share pages' exclusion of hidden games."""

from app.models.catalog import Game, GameCategory


def _make_game(db_session, name, hide_from_public=False):
    game = Game(
        name=name,
        slug=name.lower().replace(" ", "-"),
        category=GameCategory.MAIN_GAME,
        hide_from_public=hide_from_public,
    )
    db_session.add(game)
    db_session.commit()
    return game


def _get_token(auth_client):
    return auth_client.get("/api/share-link").json()["token"]


def test_patch_visibility_toggles_flag(auth_client, db_session):
    game = _make_game(db_session, "Toggle Game")

    response = auth_client.patch(f"/api/games/{game.id}/visibility", json={"hideFromPublic": True})

    assert response.status_code == 200
    assert response.json()["hideFromPublic"] is True
    db_session.refresh(game)
    assert game.hide_from_public is True

    response = auth_client.patch(f"/api/games/{game.id}/visibility", json={"hideFromPublic": False})

    assert response.status_code == 200
    assert response.json()["hideFromPublic"] is False
    db_session.refresh(game)
    assert game.hide_from_public is False


def test_patch_visibility_missing_game_is_404(auth_client):
    response = auth_client.patch("/api/games/999999/visibility", json={"hideFromPublic": True})

    assert response.status_code == 404


def test_bulk_visibility_updates_all_listed_games(auth_client, db_session):
    first = _make_game(db_session, "Bulk One")
    second = _make_game(db_session, "Bulk Two")
    untouched = _make_game(db_session, "Bulk Three")

    response = auth_client.post(
        "/api/games/bulk-visibility",
        json={"gameIds": [first.id, second.id], "hideFromPublic": True},
    )

    assert response.status_code == 200
    assert response.json() == {"updated": 2}
    db_session.refresh(first)
    db_session.refresh(second)
    db_session.refresh(untouched)
    assert first.hide_from_public is True
    assert second.hide_from_public is True
    assert untouched.hide_from_public is False


def test_public_list_excludes_hidden_games(auth_client, client, db_session):
    _make_game(db_session, "Visible Game")
    _make_game(db_session, "Secret Game", hide_from_public=True)
    token = _get_token(auth_client)

    response = client.get(f"/api/public/{token}/games")

    assert response.status_code == 200
    assert [game["name"] for game in response.json()] == ["Visible Game"]


def test_public_detail_hidden_game_is_404(auth_client, client, db_session):
    visible = _make_game(db_session, "Visible Game")
    hidden = _make_game(db_session, "Secret Game", hide_from_public=True)
    token = _get_token(auth_client)

    assert client.get(f"/api/public/{token}/games/{visible.id}").status_code == 200
    assert client.get(f"/api/public/{token}/games/{hidden.id}").status_code == 404
