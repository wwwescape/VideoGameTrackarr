from app.models.hardware import Device


def test_list_device_notes_requires_auth(client, seed_device):
    response = client.get(f"/api/devices/{seed_device.id}/notes")

    assert response.status_code == 401


def test_create_and_list_device_notes(auth_client, seed_device):
    create_response = auth_client.post(f"/api/devices/{seed_device.id}/notes", json={"body": "Bought a new charger"})
    assert create_response.status_code == 201
    assert create_response.json()["body"] == "Bought a new charger"

    list_response = auth_client.get(f"/api/devices/{seed_device.id}/notes")
    assert [note["body"] for note in list_response.json()] == ["Bought a new charger"]


def test_create_device_note_rejects_empty_body(auth_client, seed_device):
    response = auth_client.post(f"/api/devices/{seed_device.id}/notes", json={"body": ""})

    assert response.status_code == 422


def test_create_device_note_404_for_missing_device(auth_client):
    response = auth_client.post("/api/devices/999999/notes", json={"body": "x"})

    assert response.status_code == 404


def test_update_device_note(auth_client, seed_device):
    create_response = auth_client.post(f"/api/devices/{seed_device.id}/notes", json={"body": "draft"})
    note_id = create_response.json()["id"]

    response = auth_client.put(f"/api/device-notes/{note_id}", json={"body": "final"})

    assert response.status_code == 200
    assert response.json()["body"] == "final"


def test_update_device_note_404_for_missing_note(auth_client):
    response = auth_client.put("/api/device-notes/999999", json={"body": "x"})

    assert response.status_code == 404


def test_delete_device_note(auth_client, seed_device):
    create_response = auth_client.post(f"/api/devices/{seed_device.id}/notes", json={"body": "draft"})
    note_id = create_response.json()["id"]

    response = auth_client.delete(f"/api/device-notes/{note_id}")

    assert response.status_code == 204
    assert auth_client.get(f"/api/devices/{seed_device.id}/notes").json() == []


def test_delete_device_note_404_for_missing_note(auth_client):
    response = auth_client.delete("/api/device-notes/999999")

    assert response.status_code == 404


def test_device_notes_are_scoped_to_their_device(
    auth_client, db_session, seed_device, seed_manufacturer, seed_device_type
):
    other_device = Device(
        manufacturer_id=seed_manufacturer.id, device_type_id=seed_device_type.id, official_name="Other Device"
    )
    db_session.add(other_device)
    db_session.commit()

    auth_client.post(f"/api/devices/{seed_device.id}/notes", json={"body": "for seed_device"})
    auth_client.post(f"/api/devices/{other_device.id}/notes", json={"body": "for other_device"})

    response = auth_client.get(f"/api/devices/{seed_device.id}/notes")

    assert [note["body"] for note in response.json()] == ["for seed_device"]
