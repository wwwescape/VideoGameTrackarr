from app.models.hardware import AccessoryCompatibility, HardwarePlatform, UserAccessory, UserDevice
from app.models.library import LibraryStatus

PATH = "/api/hardware-platforms/library"


def test_library_hardware_platforms_requires_auth(client):
    assert client.get(PATH).status_code == 401


def test_library_hardware_platforms_empty_without_owned_or_wishlisted_hardware(auth_client, seed_device):
    # A device with no owned or wishlisted copy doesn't put its platform on the list.
    response = auth_client.get(PATH)

    assert response.status_code == 200
    assert response.json() == []


def test_library_hardware_platforms_counts_devices_and_compatible_accessories(
    auth_client, db_session, seed_device, seed_accessory, seed_hardware_platform
):
    other = HardwarePlatform(name="Nintendo Switch")
    db_session.add(other)
    db_session.flush()
    db_session.add_all(
        [
            UserDevice(device_id=seed_device.id, status=LibraryStatus.OWNED),
            UserAccessory(accessory_id=seed_accessory.id, status=LibraryStatus.WISHLIST),
            AccessoryCompatibility(accessory_id=seed_accessory.id, hardware_platform_id=seed_hardware_platform.id),
            AccessoryCompatibility(accessory_id=seed_accessory.id, hardware_platform_id=other.id),
        ]
    )
    db_session.commit()

    response = auth_client.get(PATH)

    assert response.status_code == 200
    rows = {row["name"]: row for row in response.json()}
    assert list(rows) == ["Nintendo Switch", "PlayStation 5"]
    assert rows["PlayStation 5"] | {"imageUrls": []} == {
        "id": seed_hardware_platform.id,
        "name": "PlayStation 5",
        "deviceCount": 1,
        "accessoryCount": 1,
        "ownedCount": 1,
        "wishlistedCount": 1,
        "imageUrls": [],
    }
    assert rows["Nintendo Switch"]["deviceCount"] == 0
    assert rows["Nintendo Switch"]["accessoryCount"] == 1
    assert rows["Nintendo Switch"]["wishlistedCount"] == 1
