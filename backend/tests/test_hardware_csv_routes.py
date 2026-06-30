from app.models.hardware import Accessory, UserAccessory, UserDevice
from app.models.library import LibraryStatus

CSV_HEADER = (
    "type,official_name,manufacturer,category,platform,model,edition,status,"
    "condition,purchase_price,serial_number,notes"
)


def test_export_hardware_csv_requires_auth(client):
    response = client.get("/api/export/hardware-csv")

    assert response.status_code == 401


def test_export_hardware_csv_includes_existing_data(
    auth_client, db_session, seed_device, seed_manufacturer, seed_accessory_type
):
    accessory = Accessory(
        manufacturer_id=seed_manufacturer.id, accessory_type_id=seed_accessory_type.id, official_name="DualSense"
    )
    db_session.add(accessory)
    db_session.flush()
    db_session.add(UserDevice(device_id=seed_device.id, status=LibraryStatus.OWNED))
    db_session.add(UserAccessory(accessory_id=accessory.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get("/api/export/hardware-csv")

    assert response.status_code == 200
    assert "attachment" in response.headers["content-disposition"]
    lines = response.text.strip().splitlines()
    assert lines[0] == CSV_HEADER
    assert any(seed_device.official_name in line for line in lines[1:])
    assert any("DualSense" in line for line in lines[1:])
