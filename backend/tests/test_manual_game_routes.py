def test_create_manual_game_requires_auth(client):
    response = client.post("/api/games/manual", json={"name": "My Homebrew Game"})

    assert response.status_code == 401


def test_create_manual_game_minimal(auth_client):
    response = auth_client.post("/api/games/manual", json={"name": "My Homebrew Game"})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "My Homebrew Game"
    assert body["igdbId"] is None
    assert body["category"] == "main_game"


def test_create_manual_game_with_all_fields(auth_client):
    response = auth_client.post(
        "/api/games/manual",
        json={
            "name": "Indie Gem",
            "category": "dlc_addon",
            "firstReleaseDate": 1700000000,
            "summary": "A neat little game.",
            "coverUrl": "https://example.com/cover.jpg",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["category"] == "dlc_addon"
    assert body["firstReleaseDate"] == 1700000000
    assert body["summary"] == "A neat little game."
    assert body["coverUrl"] == "https://example.com/cover.jpg"


def test_create_manual_game_rejects_empty_name(auth_client):
    response = auth_client.post("/api/games/manual", json={"name": ""})

    assert response.status_code == 422


def test_manual_game_appears_in_list(auth_client):
    auth_client.post("/api/games/manual", json={"name": "My Homebrew Game"})

    response = auth_client.get("/api/games")

    assert [g["name"] for g in response.json()] == ["My Homebrew Game"]


def test_create_manual_game_with_parent(auth_client, seed_game):
    response = auth_client.post(
        "/api/games/manual",
        json={"name": "Homebrew DLC", "category": "dlc_addon", "parentGameId": seed_game.id},
    )

    assert response.status_code == 201
    assert response.json()["parentGameId"] == seed_game.id


def test_create_manual_game_rejects_missing_parent(auth_client):
    response = auth_client.post(
        "/api/games/manual",
        json={"name": "Homebrew DLC", "category": "dlc_addon", "parentGameId": 999999},
    )

    assert response.status_code == 404


def test_create_manual_game_with_extended_fields(auth_client):
    response = auth_client.post(
        "/api/games/manual",
        json={
            "name": "Indie Gem",
            "storyline": "A tale of two pixels.",
            "edition": "Game of the Year Edition",
            "developedBy": ["Tiny Studio"],
            "publishedBy": ["Tiny Studio", "Big Publisher"],
            "platformNames": ["PC", "Switch"],
            "notes": "Picked this up on sale.",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["storyline"] == "A tale of two pixels."
    assert body["edition"] == "Game of the Year Edition"
    companies_by_role: dict[str, list[str]] = {}
    for company in body["companies"]:
        companies_by_role.setdefault(company["role"], []).append(company["name"])
    assert companies_by_role["developer"] == ["Tiny Studio"]
    assert sorted(companies_by_role["publisher"]) == ["Big Publisher", "Tiny Studio"]
    assert sorted(p["name"] for p in body["platforms"]) == ["PC", "Switch"]

    notes_response = auth_client.get(f"/api/games/{body['id']}/notes")
    assert [n["body"] for n in notes_response.json()] == ["Picked this up on sale."]


def test_create_manual_game_reuses_existing_company_by_name(auth_client):
    first = auth_client.post(
        "/api/games/manual", json={"name": "Game One", "developedBy": ["Shared Studio"]}
    ).json()
    second = auth_client.post(
        "/api/games/manual", json={"name": "Game Two", "developedBy": ["Shared Studio"]}
    ).json()

    first_company_id = next(c["id"] for c in first["companies"] if c["name"] == "Shared Studio")
    second_company_id = next(c["id"] for c in second["companies"] if c["name"] == "Shared Studio")
    assert first_company_id == second_company_id


def test_update_manual_game_requires_auth(client):
    response = client.patch("/api/games/1/manual", json={"name": "New Name"})

    assert response.status_code == 401


def test_update_manual_game_updates_fields(auth_client):
    created = auth_client.post(
        "/api/games/manual", json={"name": "My Homebrew Game", "developedBy": ["Tiny Studio"]}
    ).json()

    response = auth_client.patch(
        f"/api/games/{created['id']}/manual",
        json={
            "name": "My Homebrew Game (Remastered)",
            "summary": "Now with more pixels.",
            "developedBy": ["Tiny Studio", "Big Helper"],
            "platformNames": ["PC"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "My Homebrew Game (Remastered)"
    assert body["summary"] == "Now with more pixels."
    assert sorted(c["name"] for c in body["companies"]) == ["Big Helper", "Tiny Studio"]
    assert [p["name"] for p in body["platforms"]] == ["PC"]


def test_update_manual_game_can_clear_developed_by(auth_client):
    created = auth_client.post(
        "/api/games/manual", json={"name": "Game One", "developedBy": ["Tiny Studio"]}
    ).json()

    response = auth_client.patch(f"/api/games/{created['id']}/manual", json={"developedBy": []})

    assert response.status_code == 200
    assert response.json()["companies"] == []


def test_update_manual_game_rejects_igdb_linked_game(auth_client, seed_game):
    response = auth_client.patch(f"/api/games/{seed_game.id}/manual", json={"name": "Hacked Name"})

    assert response.status_code == 409


def test_update_manual_game_404_for_missing(auth_client):
    response = auth_client.patch("/api/games/999999/manual", json={"name": "Ghost Game"})

    assert response.status_code == 404


def test_update_manual_game_rejects_missing_parent(auth_client):
    created = auth_client.post("/api/games/manual", json={"name": "Homebrew DLC", "category": "dlc_addon"}).json()

    response = auth_client.patch(f"/api/games/{created['id']}/manual", json={"parentGameId": 999999})

    assert response.status_code == 404
