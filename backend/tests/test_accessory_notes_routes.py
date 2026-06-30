from app.models.hardware import Accessory


def test_list_accessory_notes_requires_auth(client, seed_accessory):
    response = client.get(f"/api/accessories/{seed_accessory.id}/notes")

    assert response.status_code == 401


def test_create_and_list_accessory_notes(auth_client, seed_accessory):
    create_response = auth_client.post(
        f"/api/accessories/{seed_accessory.id}/notes", json={"body": "Replaced the thumbsticks"}
    )
    assert create_response.status_code == 201
    assert create_response.json()["body"] == "Replaced the thumbsticks"

    list_response = auth_client.get(f"/api/accessories/{seed_accessory.id}/notes")
    assert [note["body"] for note in list_response.json()] == ["Replaced the thumbsticks"]


def test_create_accessory_note_rejects_empty_body(auth_client, seed_accessory):
    response = auth_client.post(f"/api/accessories/{seed_accessory.id}/notes", json={"body": ""})

    assert response.status_code == 422


def test_create_accessory_note_404_for_missing_accessory(auth_client):
    response = auth_client.post("/api/accessories/999999/notes", json={"body": "x"})

    assert response.status_code == 404


def test_update_accessory_note(auth_client, seed_accessory):
    create_response = auth_client.post(f"/api/accessories/{seed_accessory.id}/notes", json={"body": "draft"})
    note_id = create_response.json()["id"]

    response = auth_client.put(f"/api/accessory-notes/{note_id}", json={"body": "final"})

    assert response.status_code == 200
    assert response.json()["body"] == "final"


def test_update_accessory_note_404_for_missing_note(auth_client):
    response = auth_client.put("/api/accessory-notes/999999", json={"body": "x"})

    assert response.status_code == 404


def test_delete_accessory_note(auth_client, seed_accessory):
    create_response = auth_client.post(f"/api/accessories/{seed_accessory.id}/notes", json={"body": "draft"})
    note_id = create_response.json()["id"]

    response = auth_client.delete(f"/api/accessory-notes/{note_id}")

    assert response.status_code == 204
    assert auth_client.get(f"/api/accessories/{seed_accessory.id}/notes").json() == []


def test_delete_accessory_note_404_for_missing_note(auth_client):
    response = auth_client.delete("/api/accessory-notes/999999")

    assert response.status_code == 404


def test_accessory_notes_are_scoped_to_their_accessory(
    auth_client, db_session, seed_accessory, seed_manufacturer, seed_accessory_type
):
    other_accessory = Accessory(
        manufacturer_id=seed_manufacturer.id, accessory_type_id=seed_accessory_type.id, official_name="Other Accessory"
    )
    db_session.add(other_accessory)
    db_session.commit()

    auth_client.post(f"/api/accessories/{seed_accessory.id}/notes", json={"body": "for seed_accessory"})
    auth_client.post(f"/api/accessories/{other_accessory.id}/notes", json={"body": "for other_accessory"})

    response = auth_client.get(f"/api/accessories/{seed_accessory.id}/notes")

    assert [note["body"] for note in response.json()] == ["for seed_accessory"]
