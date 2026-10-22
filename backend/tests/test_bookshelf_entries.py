"""GET /api/games/bookshelf: the slim payload the Bookshelf page loads —
one entry per owned (game x platform), formats merged, wishlist excluded."""


def _add_copy(auth_client, game_id, platform_id, status, fmt=None):
    body = {"status": status, "platformId": platform_id}
    if fmt is not None:
        body["format"] = fmt
    response = auth_client.post(f"/api/games/{game_id}/library", json=body)
    assert response.status_code == 201
    return response.json()


def test_bookshelf_entries_only_owned_with_merged_formats(auth_client, seed_game, seed_platform):
    # Two owned copies on the same platform (physical + digital) merge into
    # one entry carrying both formats.
    _add_copy(auth_client, seed_game.id, seed_platform.id, "owned", "physical")
    _add_copy(auth_client, seed_game.id, seed_platform.id, "owned", "digital")
    # A wishlist copy must not appear.
    _add_copy(auth_client, seed_game.id, seed_platform.id, "wishlist")

    response = auth_client.get("/api/games/bookshelf")
    assert response.status_code == 200
    entries = response.json()
    assert len(entries) == 1
    [entry] = entries
    assert entry["gameId"] == seed_game.id
    assert entry["name"] == seed_game.name
    assert entry["platformLabel"] == "PlayStation 5"
    assert sorted(entry["formats"]) == ["digital", "physical"]
    assert entry["gameUuid"] == seed_game.uuid


def test_bookshelf_entries_empty_library(auth_client):
    response = auth_client.get("/api/games/bookshelf")
    assert response.status_code == 200
    assert response.json() == []
