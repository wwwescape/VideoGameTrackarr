from app.models.hardware import Accessory


def _create_accessory(auth_client) -> int:
    response = auth_client.post(
        "/api/accessories", json={"manufacturer": "Sony", "accessoryType": "Controller", "officialName": "DualSense"}
    )
    return response.json()["id"]


def test_add_user_accessory_requires_auth(client, db_session, seed_manufacturer, seed_accessory_type):
    accessory = Accessory(
        manufacturer_id=seed_manufacturer.id, accessory_type_id=seed_accessory_type.id, official_name="DualSense"
    )
    db_session.add(accessory)
    db_session.commit()

    response = client.get(f"/api/accessories/{accessory.id}/user-accessories")

    assert response.status_code == 401


def test_add_user_accessory_404_for_missing_accessory(auth_client):
    response = auth_client.post("/api/accessories/999999/user-accessories", json={"status": "owned"})

    assert response.status_code == 404


def test_update_user_accessory(auth_client):
    accessory_id = _create_accessory(auth_client)
    item = auth_client.post(f"/api/accessories/{accessory_id}/user-accessories", json={"status": "wishlist"}).json()

    response = auth_client.patch(f"/api/user-accessories/{item['id']}", json={"status": "owned"})

    assert response.status_code == 200
    assert response.json()["status"] == "owned"


def test_delete_user_accessory(auth_client):
    accessory_id = _create_accessory(auth_client)
    item = auth_client.post(f"/api/accessories/{accessory_id}/user-accessories", json={"status": "owned"}).json()

    response = auth_client.delete(f"/api/user-accessories/{item['id']}")

    assert response.status_code == 204
    assert auth_client.get(f"/api/accessories/{accessory_id}/user-accessories").json() == []
