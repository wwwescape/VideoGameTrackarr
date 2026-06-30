from app.models.hardware import (
    Device,
    DeviceNote,
    DeviceTag,
    HardwareReferenceEntry,
    Manufacturer,
    UserDevice,
)


def test_list_devices_requires_auth(client):
    response = client.get("/api/devices")

    assert response.status_code == 401


def test_create_device_resolves_lookups_by_name_creating_new_rows(auth_client, db_session):
    response = auth_client.post(
        "/api/devices",
        json={
            "manufacturer": "Sony",
            "deviceType": "Console",
            "hardwarePlatform": "PlayStation 5",
            "officialName": "Sony PlayStation 5",
            "color": "Jet Black",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["officialName"] == "Sony PlayStation 5"
    assert body["manufacturerName"] == "Sony"
    assert body["hardwarePlatformName"] == "PlayStation 5"
    assert body["colorName"] == "Jet Black"
    assert body["owned"] is False
    assert body["tags"] == []
    # uuid is generated server-side, not user-supplied
    assert len(body["uuid"]) == 36

    # Re-posting the same manufacturer name reuses the row rather than duplicating it.
    auth_client.post(
        "/api/devices",
        json={"manufacturer": "Sony", "deviceType": "Handheld", "officialName": "Sony PSP"},
    )
    assert db_session.query(Manufacturer).filter_by(name="Sony").count() == 1


def test_create_device_with_rating_board(auth_client):
    response = auth_client.post(
        "/api/devices",
        json={"manufacturer": "Sony", "deviceType": "Console", "officialName": "Sony PS5", "ratingBoard": "pegi"},
    )

    assert response.status_code == 201
    assert response.json()["ratingBoard"] == "pegi"


def test_create_device_with_hardware_reference_entry_links_it_and_shows_rich_data(auth_client, db_session):
    entry = HardwareReferenceEntry(
        brand="Sony",
        family="PlayStation",
        generation="PlayStation 5",
        artefact="PlayStation 5",
        official_name="Sony PlayStation 5 (reference)",
        category="Console",
        type="Device",
        release_date="2020",
        discontinued=False,
        compatibility="PlayStation 5",
        summary="A console.",
    )
    db_session.add(entry)
    db_session.commit()

    response = auth_client.post(
        "/api/devices",
        json={
            "manufacturer": "Sony",
            "deviceType": "Console",
            "officialName": "Sony PS5",
            "hardwareReferenceEntryId": entry.id,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["hardwareReference"]["family"] == "PlayStation"
    assert body["hardwareReference"]["category"] == "Console"
    assert body["hardwareReference"]["releaseDate"] == "2020"
    assert body["hardwareReference"]["summary"] == "A console."


def test_create_device_without_hardware_reference_entry_has_no_rich_data(auth_client):
    response = auth_client.post(
        "/api/devices", json={"manufacturer": "Sony", "deviceType": "Console", "officialName": "Sony PS5"}
    )

    assert response.status_code == 201
    assert response.json()["hardwareReference"] is None


def test_create_device_with_ownership_creates_both_rows_in_one_call(auth_client, db_session):
    response = auth_client.post(
        "/api/devices",
        json={
            "manufacturer": "Sony",
            "deviceType": "Console",
            "officialName": "Sony PS5",
            "ownership": {"status": "owned", "condition": "good", "serialNumber": "SN-1", "purchasePrice": 499.99},
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["owned"] is True
    assert body["ownedQuantity"] == 1

    [user_device] = db_session.query(UserDevice).filter_by(device_id=body["id"]).all()
    assert user_device.status.value == "owned"
    assert user_device.condition.value == "good"
    assert user_device.serial_number == "SN-1"
    assert user_device.purchase_price == 499.99


def test_create_device_without_ownership_creates_no_user_device(auth_client, db_session):
    response = auth_client.post(
        "/api/devices", json={"manufacturer": "Sony", "deviceType": "Console", "officialName": "Sony PS5"}
    )

    assert response.status_code == 201
    assert db_session.query(UserDevice).filter_by(device_id=response.json()["id"]).count() == 0


def test_create_device_requires_manufacturer_and_type(auth_client):
    response = auth_client.post("/api/devices", json={"officialName": "Missing fields"})

    assert response.status_code == 422


def test_get_device_404_for_missing(auth_client):
    response = auth_client.get("/api/devices/999999")

    assert response.status_code == 404


def test_get_device_by_numeric_id_404s(auth_client, seed_device):
    """The whole point of switching to slug+uuid lookup — the old numeric id must not
    resolve, or it'd still be enumerable."""
    response = auth_client.get(f"/api/devices/{seed_device.id}")

    assert response.status_code == 404


def test_get_device_by_bare_uuid_resolves_without_a_slug(auth_client, seed_device):
    response = auth_client.get(f"/api/devices/{seed_device.uuid}")

    assert response.status_code == 200
    assert response.json()["id"] == seed_device.id


def test_update_device_partial_update_only_changes_given_fields(auth_client, seed_device):
    response = auth_client.patch(f"/api/devices/{seed_device.id}", json={"revision": "v2"})

    assert response.status_code == 200
    body = response.json()
    assert body["revision"] == "v2"
    assert body["officialName"] == seed_device.official_name


def test_update_device_404_for_missing(auth_client):
    response = auth_client.patch("/api/devices/999999", json={"revision": "v2"})

    assert response.status_code == 404


def test_update_device_can_link_hardware_reference_entry(auth_client, db_session, seed_device):
    entry = HardwareReferenceEntry(
        brand="Sony",
        generation="PlayStation 5",
        artefact="PlayStation 5",
        official_name="Sony PlayStation 5 (backfill)",
        category="Console",
        type="Device",
        discontinued=False,
    )
    db_session.add(entry)
    db_session.commit()

    response = auth_client.patch(f"/api/devices/{seed_device.id}", json={"hardwareReferenceEntryId": entry.id})

    assert response.status_code == 200
    assert response.json()["hardwareReference"]["artefact"] == "PlayStation 5"


def test_delete_device(auth_client, db_session, seed_device):
    response = auth_client.delete(f"/api/devices/{seed_device.id}")

    assert response.status_code == 204
    assert db_session.get(Device, seed_device.id) is None


def test_delete_device_cleans_up_tags_and_notes(auth_client, db_session, seed_device):
    tag_id = auth_client.post("/api/tags", json={"name": "Modded"}).json()["id"]
    auth_client.post(f"/api/devices/{seed_device.id}/tags/{tag_id}")
    auth_client.post(f"/api/devices/{seed_device.id}/notes", json={"body": "note"})

    auth_client.delete(f"/api/devices/{seed_device.id}")

    assert db_session.query(DeviceTag).filter_by(device_id=seed_device.id).count() == 0
    assert db_session.query(DeviceNote).filter_by(device_id=seed_device.id).count() == 0


def test_list_devices_filters_by_manufacturer_type_platform_and_search(
    auth_client, db_session, seed_manufacturer, seed_device_type, seed_hardware_platform
):
    other_manufacturer = Manufacturer(name="Microsoft")
    db_session.add(other_manufacturer)
    db_session.commit()
    db_session.add_all(
        [
            Device(
                manufacturer_id=seed_manufacturer.id,
                device_type_id=seed_device_type.id,
                hardware_platform_id=seed_hardware_platform.id,
                official_name="Sony PlayStation 5",
            ),
            Device(
                manufacturer_id=other_manufacturer.id,
                device_type_id=seed_device_type.id,
                official_name="Microsoft Xbox Series X",
            ),
        ]
    )
    db_session.commit()

    response = auth_client.get("/api/devices", params={"manufacturerId": seed_manufacturer.id})
    assert [d["officialName"] for d in response.json()] == ["Sony PlayStation 5"]

    response = auth_client.get("/api/devices", params={"search": "xbox"})
    assert [d["officialName"] for d in response.json()] == ["Microsoft Xbox Series X"]

    response = auth_client.get("/api/devices", params={"hardwarePlatformId": seed_hardware_platform.id})
    assert [d["officialName"] for d in response.json()] == ["Sony PlayStation 5"]


def test_list_devices_filters_by_ownership_status(auth_client, seed_device):
    auth_client.post(f"/api/devices/{seed_device.id}/user-devices", json={"status": "owned"})

    owned = auth_client.get("/api/devices", params={"status": "owned"}).json()
    assert [d["id"] for d in owned] == [seed_device.id]

    wishlist = auth_client.get("/api/devices", params={"status": "wishlist"}).json()
    assert wishlist == []
