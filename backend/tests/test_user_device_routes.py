def test_add_user_device_requires_auth(client, seed_device):
    response = client.get(f"/api/devices/{seed_device.id}/user-devices")

    assert response.status_code == 401


def test_add_user_device_404_for_missing_device(auth_client):
    response = auth_client.post("/api/devices/999999/user-devices", json={"status": "owned"})

    assert response.status_code == 404


def test_add_user_device_with_condition_price_and_serial_number(auth_client, seed_device):
    response = auth_client.post(
        f"/api/devices/{seed_device.id}/user-devices",
        json={
            "status": "owned",
            "condition": "like_new",
            "purchasePrice": 499.99,
            "serialNumber": "ABC123",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["condition"] == "like_new"
    assert body["purchasePrice"] == 499.99
    assert body["serialNumber"] == "ABC123"


def test_list_user_devices_filters_by_status(auth_client, seed_device):
    auth_client.post(f"/api/devices/{seed_device.id}/user-devices", json={"status": "owned"})
    auth_client.post(f"/api/devices/{seed_device.id}/user-devices", json={"status": "wishlist"})

    owned = auth_client.get(
        f"/api/devices/{seed_device.id}/user-devices", params={"status": "owned"}
    ).json()
    assert len(owned) == 1
    assert owned[0]["status"] == "owned"


def test_two_copies_of_same_device_are_independent_rows(auth_client, seed_device):
    first = auth_client.post(
        f"/api/devices/{seed_device.id}/user-devices",
        json={"status": "owned", "condition": "sealed", "serialNumber": "A"},
    ).json()
    second = auth_client.post(
        f"/api/devices/{seed_device.id}/user-devices",
        json={"status": "owned", "condition": "good", "serialNumber": "B"},
    ).json()

    assert first["id"] != second["id"]
    all_items = auth_client.get(f"/api/devices/{seed_device.id}/user-devices").json()
    assert len(all_items) == 2


def test_update_user_device(auth_client, seed_device):
    item = auth_client.post(f"/api/devices/{seed_device.id}/user-devices", json={"status": "wishlist"}).json()

    response = auth_client.patch(f"/api/user-devices/{item['id']}", json={"status": "owned"})

    assert response.status_code == 200
    assert response.json()["status"] == "owned"


def test_update_user_device_404_for_missing(auth_client):
    response = auth_client.patch("/api/user-devices/999999", json={"status": "owned"})

    assert response.status_code == 404


def test_delete_user_device(auth_client, seed_device):
    item = auth_client.post(f"/api/devices/{seed_device.id}/user-devices", json={"status": "owned"}).json()

    response = auth_client.delete(f"/api/user-devices/{item['id']}")

    assert response.status_code == 204
    assert auth_client.get(f"/api/devices/{seed_device.id}/user-devices").json() == []
