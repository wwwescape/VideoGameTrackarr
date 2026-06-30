from app.models.hardware import (
    Accessory,
    AccessoryNote,
    AccessoryTag,
    Device,
    HardwarePlatform,
    HardwareReferenceEntry,
    UserAccessory,
)


def test_list_accessories_requires_auth(client):
    response = client.get("/api/accessories")

    assert response.status_code == 401


def test_create_accessory_resolves_lookups_and_compatibility(auth_client):
    response = auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Sony",
            "accessoryType": "Controller",
            "officialName": "DualSense",
            "compatiblePlatforms": ["PlayStation 5", "PlayStation 5 Pro"],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["officialName"] == "DualSense"
    assert body["manufacturerName"] == "Sony"
    platform_names = {p["name"] for p in body["compatiblePlatforms"]}
    assert platform_names == {"PlayStation 5", "PlayStation 5 Pro"}
    assert body["owned"] is False


def test_get_accessory_404_for_missing(auth_client):
    response = auth_client.get("/api/accessories/999999")

    assert response.status_code == 404


def test_get_accessory_by_numeric_id_404s(auth_client, seed_accessory):
    """The whole point of switching to slug+uuid lookup — the old numeric id must not
    resolve, or it'd still be enumerable."""
    response = auth_client.get(f"/api/accessories/{seed_accessory.id}")

    assert response.status_code == 404


def test_get_accessory_by_bare_uuid_resolves_without_a_slug(auth_client, seed_accessory):
    response = auth_client.get(f"/api/accessories/{seed_accessory.uuid}")

    assert response.status_code == 200
    assert response.json()["id"] == seed_accessory.id


def test_create_accessory_with_rating_board_and_revision(auth_client):
    response = auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Sony",
            "accessoryType": "Controller",
            "officialName": "DualSense",
            "ratingBoard": "esrb",
            "revision": "v2",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["ratingBoard"] == "esrb"
    assert body["revision"] == "v2"


def test_create_accessory_with_summary(auth_client):
    response = auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Sony",
            "accessoryType": "Controller",
            "officialName": "Custom Controller",
            "summary": "A hand-modded controller with custom paddles.",
        },
    )

    assert response.status_code == 201
    assert response.json()["summary"] == "A hand-modded controller with custom paddles."
    assert response.json()["tags"] == []


def test_update_accessory_summary(auth_client, seed_accessory):
    response = auth_client.patch(
        f"/api/accessories/{seed_accessory.id}", json={"summary": "Updated summary text."}
    )

    assert response.status_code == 200
    assert response.json()["summary"] == "Updated summary text."


def test_delete_accessory_cleans_up_tags_and_notes(auth_client, db_session, seed_accessory):
    tag_id = auth_client.post("/api/tags", json={"name": "For Sale"}).json()["id"]
    auth_client.post(f"/api/accessories/{seed_accessory.id}/tags/{tag_id}")
    auth_client.post(f"/api/accessories/{seed_accessory.id}/notes", json={"body": "note"})

    auth_client.delete(f"/api/accessories/{seed_accessory.id}")

    assert db_session.query(AccessoryTag).filter_by(accessory_id=seed_accessory.id).count() == 0
    assert db_session.query(AccessoryNote).filter_by(accessory_id=seed_accessory.id).count() == 0


def test_create_accessory_with_hardware_reference_entry_links_it_and_shows_rich_data(auth_client, db_session):
    entry = HardwareReferenceEntry(
        brand="Sony",
        family="PlayStation",
        generation="PlayStation 5",
        artefact="DualSense",
        official_name="Sony DualSense (reference)",
        category="Controller",
        type="Accessory",
        release_date="2020",
        discontinued=False,
        compatibility="PlayStation 5",
        summary="A controller.",
    )
    db_session.add(entry)
    db_session.commit()

    response = auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Sony",
            "accessoryType": "Controller",
            "officialName": "DualSense",
            "hardwareReferenceEntryId": entry.id,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["hardwareReference"]["family"] == "PlayStation"
    assert body["hardwareReference"]["category"] == "Controller"
    assert body["hardwareReference"]["summary"] == "A controller."


def test_create_accessory_without_hardware_reference_entry_has_no_rich_data(auth_client):
    response = auth_client.post(
        "/api/accessories",
        json={"manufacturer": "Sony", "accessoryType": "Controller", "officialName": "DualSense"},
    )

    assert response.status_code == 201
    assert response.json()["hardwareReference"] is None


def test_create_accessory_with_ownership_creates_both_rows_in_one_call(auth_client, db_session):
    response = auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Sony",
            "accessoryType": "Controller",
            "officialName": "DualSense",
            "ownership": {"status": "wishlist", "condition": "new", "serialNumber": "SN-2"},
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["wishlisted"] is True

    [user_accessory] = db_session.query(UserAccessory).filter_by(accessory_id=body["id"]).all()
    assert user_accessory.status.value == "wishlist"
    assert user_accessory.condition.value == "new"
    assert user_accessory.serial_number == "SN-2"


def test_create_accessory_without_ownership_creates_no_user_accessory(auth_client, db_session):
    response = auth_client.post(
        "/api/accessories", json={"manufacturer": "Sony", "accessoryType": "Controller", "officialName": "DualSense"}
    )

    assert response.status_code == 201
    assert db_session.query(UserAccessory).filter_by(accessory_id=response.json()["id"]).count() == 0


def test_update_accessory_can_link_hardware_reference_entry(auth_client, db_session, seed_accessory):
    entry = HardwareReferenceEntry(
        brand="Sony",
        generation="PlayStation 5",
        artefact="DualSense",
        official_name="Sony DualSense (backfill)",
        category="Controller",
        type="Accessory",
        discontinued=False,
    )
    db_session.add(entry)
    db_session.commit()

    response = auth_client.patch(
        f"/api/accessories/{seed_accessory.id}", json={"hardwareReferenceEntryId": entry.id}
    )

    assert response.status_code == 200
    assert response.json()["hardwareReference"]["artefact"] == "DualSense"


def test_update_accessory_replaces_compatible_platforms(auth_client):
    create_response = auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Nintendo",
            "accessoryType": "Dock",
            "officialName": "Switch Dock",
            "compatiblePlatforms": ["Nintendo Switch"],
        },
    )
    accessory_id = create_response.json()["id"]

    update_response = auth_client.patch(
        f"/api/accessories/{accessory_id}", json={"compatiblePlatforms": ["Nintendo Switch", "Nintendo Switch OLED"]}
    )

    assert update_response.status_code == 200
    platform_names = {p["name"] for p in update_response.json()["compatiblePlatforms"]}
    assert platform_names == {"Nintendo Switch", "Nintendo Switch OLED"}


def test_update_accessory_without_compatible_platforms_leaves_them_untouched(auth_client):
    create_response = auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Nintendo",
            "accessoryType": "Dock",
            "officialName": "Switch Dock",
            "compatiblePlatforms": ["Nintendo Switch"],
        },
    )
    accessory_id = create_response.json()["id"]

    update_response = auth_client.patch(f"/api/accessories/{accessory_id}", json={"revision": "v2"})

    assert update_response.status_code == 200
    platform_names = {p["name"] for p in update_response.json()["compatiblePlatforms"]}
    assert platform_names == {"Nintendo Switch"}


def test_delete_accessory(auth_client, db_session, seed_manufacturer, seed_accessory_type):
    accessory = Accessory(
        manufacturer_id=seed_manufacturer.id, accessory_type_id=seed_accessory_type.id, official_name="DualShock"
    )
    db_session.add(accessory)
    db_session.commit()

    response = auth_client.delete(f"/api/accessories/{accessory.id}")

    assert response.status_code == 204
    assert db_session.get(Accessory, accessory.id) is None


def test_create_accessory_links_to_specific_device(auth_client, seed_device):
    response = auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Sony",
            "accessoryType": "Controller",
            "officialName": "DualSense",
            "deviceIds": [seed_device.id],
        },
    )

    assert response.status_code == 201
    body = response.json()
    [linked] = body["linkedDevices"]
    assert linked["id"] == seed_device.id
    assert linked["officialName"] == seed_device.official_name


def test_create_accessory_404_for_unknown_device_id(auth_client):
    response = auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Sony",
            "accessoryType": "Controller",
            "officialName": "DualSense",
            "deviceIds": [999999],
        },
    )

    assert response.status_code == 404


def test_update_accessory_replaces_linked_devices(
    auth_client, db_session, seed_device, seed_manufacturer, seed_device_type
):
    other_device = Device(
        manufacturer_id=seed_manufacturer.id, device_type_id=seed_device_type.id, official_name="Other Console"
    )
    db_session.add(other_device)
    db_session.commit()

    create_response = auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Sony",
            "accessoryType": "Controller",
            "officialName": "DualSense",
            "deviceIds": [seed_device.id],
        },
    )
    accessory_id = create_response.json()["id"]

    update_response = auth_client.patch(
        f"/api/accessories/{accessory_id}", json={"deviceIds": [other_device.id]}
    )

    assert update_response.status_code == 200
    [linked] = update_response.json()["linkedDevices"]
    assert linked["id"] == other_device.id


def test_update_accessory_without_device_ids_leaves_links_untouched(auth_client, seed_device):
    create_response = auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Sony",
            "accessoryType": "Controller",
            "officialName": "DualSense",
            "deviceIds": [seed_device.id],
        },
    )
    accessory_id = create_response.json()["id"]

    update_response = auth_client.patch(f"/api/accessories/{accessory_id}", json={"revision": "v2"})

    assert update_response.status_code == 200
    [linked] = update_response.json()["linkedDevices"]
    assert linked["id"] == seed_device.id


def test_device_detail_shows_linked_accessories(auth_client, seed_device):
    auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Sony",
            "accessoryType": "Controller",
            "officialName": "DualSense",
            "deviceIds": [seed_device.id],
        },
    )

    response = auth_client.get(f"/api/devices/{seed_device.uuid}")

    assert response.status_code == 200
    [linked] = response.json()["linkedAccessories"]
    assert linked["officialName"] == "DualSense"


def _create_accessory(auth_client, name: str) -> tuple[int, str]:
    response = auth_client.post(
        "/api/accessories",
        json={"manufacturer": "Sony", "accessoryType": "Controller", "officialName": name},
    )
    body = response.json()
    return body["id"], body["uuid"]


def test_create_accessory_links_to_another_accessory(auth_client):
    controller_id, _ = _create_accessory(auth_client, "DualSense - Astro Bot")

    response = auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Sony",
            "accessoryType": "Case",
            "officialName": "Protection Case for DualSense - Astro Bot",
            "accessoryIds": [controller_id],
        },
    )

    assert response.status_code == 201
    [linked] = response.json()["linkedAccessories"]
    assert linked["id"] == controller_id


def test_create_accessory_404_for_unknown_accessory_id(auth_client):
    response = auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Sony",
            "accessoryType": "Controller",
            "officialName": "DualSense",
            "accessoryIds": [999999],
        },
    )

    assert response.status_code == 404


def test_linked_accessory_shows_up_on_both_sides(auth_client):
    controller_id, controller_uuid = _create_accessory(auth_client, "DualSense - Astro Bot")
    case_id, case_uuid = _create_accessory(auth_client, "Protection Case for DualSense - Astro Bot")

    auth_client.patch(f"/api/accessories/{case_id}", json={"accessoryIds": [controller_id]})

    case_response = auth_client.get(f"/api/accessories/{case_uuid}")
    [case_linked] = case_response.json()["linkedAccessories"]
    assert case_linked["id"] == controller_id

    controller_response = auth_client.get(f"/api/accessories/{controller_uuid}")
    [controller_linked] = controller_response.json()["linkedAccessories"]
    assert controller_linked["id"] == case_id


def test_update_accessory_ignores_self_link(auth_client):
    accessory_id, _ = _create_accessory(auth_client, "DualSense")

    response = auth_client.patch(f"/api/accessories/{accessory_id}", json={"accessoryIds": [accessory_id]})

    assert response.status_code == 200
    assert response.json()["linkedAccessories"] == []


def test_delete_accessory_cleans_up_links_from_both_sides(auth_client):
    controller_id, controller_uuid = _create_accessory(auth_client, "DualSense - Astro Bot")
    case_id, _ = _create_accessory(auth_client, "Protection Case for DualSense - Astro Bot")
    auth_client.patch(f"/api/accessories/{case_id}", json={"accessoryIds": [controller_id]})

    response = auth_client.delete(f"/api/accessories/{case_id}")

    assert response.status_code == 204
    controller_response = auth_client.get(f"/api/accessories/{controller_uuid}")
    assert controller_response.json()["linkedAccessories"] == []


def test_list_accessories_filters_by_compatible_platform(auth_client, db_session):
    auth_client.post(
        "/api/accessories",
        json={
            "manufacturer": "Sony",
            "accessoryType": "Controller",
            "officialName": "DualSense",
            "compatiblePlatforms": ["PlayStation 5"],
        },
    )
    auth_client.post(
        "/api/accessories",
        json={"manufacturer": "Sony", "accessoryType": "Controller", "officialName": "DualShock 4"},
    )

    platform = db_session.query(HardwarePlatform).filter_by(name="PlayStation 5").one()

    filtered = auth_client.get("/api/accessories", params={"hardwarePlatformId": platform.id}).json()
    assert [a["officialName"] for a in filtered] == ["DualSense"]
