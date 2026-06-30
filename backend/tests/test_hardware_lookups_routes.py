import pytest

from app.models.hardware import AccessoryType, Color, DeviceType, HardwarePlatform, Manufacturer, StorageVariant

LOOKUPS = [
    ("/api/manufacturers", Manufacturer, "Sony"),
    ("/api/hardware-platforms", HardwarePlatform, "PlayStation 5"),
    ("/api/device-types", DeviceType, "Console"),
    ("/api/accessory-types", AccessoryType, "Controller"),
    ("/api/storage-variants", StorageVariant, "1TB"),
    ("/api/colors", Color, "Jet Black"),
]


@pytest.mark.parametrize("path,model,name", LOOKUPS)
def test_lookup_requires_auth(client, path, model, name):
    response = client.get(path)

    assert response.status_code == 401


@pytest.mark.parametrize("path,model,name", LOOKUPS)
def test_lookup_returns_seeded_rows_sorted_by_name(auth_client, db_session, path, model, name):
    db_session.add_all([model(name="Zzz"), model(name=name)])
    db_session.commit()

    response = auth_client.get(path)

    assert response.status_code == 200
    names = [row["name"] for row in response.json()]
    assert names == sorted(names)
    assert name in names
