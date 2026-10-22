"""GET /api/public/{token}/bookshelf: the slim shelf payload for share
links — owned entries only, platform display fields included."""


def _get_token(auth_client):
    return auth_client.get("/api/share-link").json()["token"]


def _add_copy(auth_client, game_id, platform_id, status="owned", fmt="physical"):
    response = auth_client.post(
        f"/api/games/{game_id}/library",
        json={"status": status, "platformId": platform_id, "format": fmt},
    )
    assert response.status_code == 201


def test_public_bookshelf_entries_and_platforms(auth_client, client, seed_game, seed_platform):
    _add_copy(auth_client, seed_game.id, seed_platform.id)
    token = _get_token(auth_client)

    response = client.get(f"/api/public/{token}/bookshelf")
    assert response.status_code == 200
    body = response.json()
    assert len(body["entries"]) == 1
    assert body["entries"][0]["name"] == seed_game.name
    assert body["entries"][0]["platformLabel"] == "PlayStation 5"
    assert len(body["platforms"]) == 1
    platform = body["platforms"][0]
    assert platform["label"] == "PlayStation 5"
    assert platform["spineTemplateUrl"] is None
    assert platform["spineIcon"] is None


def test_public_bookshelf_wrong_token_is_404(client, seed_game):
    response = client.get("/api/public/not-a-real-token/bookshelf")
    assert response.status_code == 404
