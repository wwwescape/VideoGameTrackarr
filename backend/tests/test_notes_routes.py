from app.models.catalog import Game, GameCategory


def test_list_notes_requires_auth(client, seed_game):
    response = client.get(f"/api/games/{seed_game.id}/notes")

    assert response.status_code == 401


def test_create_and_list_notes(auth_client, seed_game):
    create_response = auth_client.post(f"/api/games/{seed_game.id}/notes", json={"body": "Got the secret ending"})
    assert create_response.status_code == 201
    assert create_response.json()["body"] == "Got the secret ending"

    list_response = auth_client.get(f"/api/games/{seed_game.id}/notes")
    assert [note["body"] for note in list_response.json()] == ["Got the secret ending"]


def test_create_note_rejects_empty_body(auth_client, seed_game):
    response = auth_client.post(f"/api/games/{seed_game.id}/notes", json={"body": ""})

    assert response.status_code == 422


def test_create_note_404_for_missing_game(auth_client):
    response = auth_client.post("/api/games/999999/notes", json={"body": "x"})

    assert response.status_code == 404


def test_update_note(auth_client, seed_game):
    create_response = auth_client.post(f"/api/games/{seed_game.id}/notes", json={"body": "draft"})
    note_id = create_response.json()["id"]

    response = auth_client.put(f"/api/notes/{note_id}", json={"body": "final"})

    assert response.status_code == 200
    assert response.json()["body"] == "final"


def test_update_note_404_for_missing_note(auth_client):
    response = auth_client.put("/api/notes/999999", json={"body": "x"})

    assert response.status_code == 404


def test_delete_note(auth_client, seed_game):
    create_response = auth_client.post(f"/api/games/{seed_game.id}/notes", json={"body": "draft"})
    note_id = create_response.json()["id"]

    response = auth_client.delete(f"/api/notes/{note_id}")

    assert response.status_code == 204
    assert auth_client.get(f"/api/games/{seed_game.id}/notes").json() == []


def test_delete_note_404_for_missing_note(auth_client):
    response = auth_client.delete("/api/notes/999999")

    assert response.status_code == 404


def test_notes_are_scoped_to_their_game(auth_client, db_session, seed_game):
    other_game = Game(igdb_id=5005, name="Other Game", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    db_session.commit()

    auth_client.post(f"/api/games/{seed_game.id}/notes", json={"body": "for seed_game"})
    auth_client.post(f"/api/games/{other_game.id}/notes", json={"body": "for other_game"})

    response = auth_client.get(f"/api/games/{seed_game.id}/notes")

    assert [note["body"] for note in response.json()] == ["for seed_game"]
