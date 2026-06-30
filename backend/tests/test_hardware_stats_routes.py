from datetime import UTC, datetime

from app.models.hardware import UserAccessory, UserDevice
from app.models.library import LibraryStatus


def test_hardware_stats_requires_auth(client):
    response = client.get("/api/hardware-stats")

    assert response.status_code == 401


def test_hardware_stats_empty_state(auth_client):
    response = auth_client.get("/api/hardware-stats")

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "ownedConsoles": 0,
        "ownedAccessories": 0,
        "wishlistHardware": 0,
        "manufacturerDistribution": [],
        "platformDistribution": [],
        "collectionValue": 0.0,
        "recentlyAdded": [],
    }


def test_hardware_stats_aggregates_owned_wishlist_and_value(auth_client, seed_device):
    # Two owned copies as two separate rows (each with its own serial number, in practice)
    # plus one wishlisted unit.
    auth_client.post(
        f"/api/devices/{seed_device.id}/user-devices",
        json={"status": "owned", "purchasePrice": 150.0},
    )
    auth_client.post(
        f"/api/devices/{seed_device.id}/user-devices",
        json={"status": "owned", "purchasePrice": 150.0},
    )
    auth_client.post(f"/api/devices/{seed_device.id}/user-devices", json={"status": "wishlist"})

    accessory = auth_client.post(
        "/api/accessories", json={"manufacturer": "Sony", "accessoryType": "Controller", "officialName": "DualSense"}
    ).json()
    auth_client.post(
        f"/api/accessories/{accessory['id']}/user-accessories",
        json={"status": "owned", "purchasePrice": 80.0},
    )

    response = auth_client.get("/api/hardware-stats")

    assert response.status_code == 200
    body = response.json()
    assert body["ownedConsoles"] == 2
    assert body["ownedAccessories"] == 1
    assert body["wishlistHardware"] == 1
    # 2 device rows * 150 (purchase_price) + 1 accessory row * 80
    assert body["collectionValue"] == 380.0
    manufacturer_names = {entry["name"] for entry in body["manufacturerDistribution"]}
    assert "Sony" in manufacturer_names


def test_hardware_stats_recently_added_includes_owned_device_and_wishlisted_accessory(
    auth_client, db_session, seed_device, seed_accessory
):
    db_session.add(UserDevice(device_id=seed_device.id, status=LibraryStatus.OWNED))
    db_session.add(UserAccessory(accessory_id=seed_accessory.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    response = auth_client.get("/api/hardware-stats")

    kinds = {item["kind"] for item in response.json()["recentlyAdded"]}
    assert kinds == {"device", "accessory"}


def test_hardware_stats_recently_added_orders_newest_addition_first(
    auth_client, db_session, seed_device, seed_accessory
):
    db_session.add(
        UserDevice(device_id=seed_device.id, status=LibraryStatus.OWNED, created_at=datetime(2024, 1, 1, tzinfo=UTC))
    )
    db_session.add(
        UserAccessory(
            accessory_id=seed_accessory.id, status=LibraryStatus.OWNED, created_at=datetime(2024, 6, 1, tzinfo=UTC)
        )
    )
    db_session.commit()

    response = auth_client.get("/api/hardware-stats")

    kinds = [item["kind"] for item in response.json()["recentlyAdded"]]
    assert kinds == ["accessory", "device"]


def test_hardware_stats_recently_added_collapses_repeated_device_to_latest_addition(
    auth_client, db_session, seed_device
):
    db_session.add(
        UserDevice(
            device_id=seed_device.id, status=LibraryStatus.WISHLIST, created_at=datetime(2024, 1, 1, tzinfo=UTC)
        )
    )
    db_session.add(
        UserDevice(device_id=seed_device.id, status=LibraryStatus.OWNED, created_at=datetime(2024, 6, 1, tzinfo=UTC))
    )
    db_session.commit()

    response = auth_client.get("/api/hardware-stats")

    recently_added = response.json()["recentlyAdded"]
    assert len(recently_added) == 1
    assert recently_added[0]["device"]["id"] == seed_device.id
