from app.models.hardware import HardwareReferenceEntry


def _entry(**overrides):
    fields = {
        "brand": "Sony",
        "family": "PlayStation",
        "generation": "PlayStation 5",
        "generation_short": "PS5",
        "artefact": "PlayStation 5",
        "official_name": "Sony PlayStation 5",
        "category": "Console",
        "type": "Device",
        "release_date": "2020-11-12",
        "discontinued": False,
        "compatibility": "PlayStation 5",
        "summary": "A console.",
    }
    fields.update(overrides)
    return HardwareReferenceEntry(**fields)


def test_list_hardware_reference_entries_requires_auth(client):
    response = client.get("/api/hardware-reference-entries")

    assert response.status_code == 401


def test_list_hardware_reference_entries_filters_by_type(auth_client, db_session):
    db_session.add_all(
        [
            _entry(),
            _entry(
                official_name="Sony DualSense",
                artefact="DualSense",
                category="Controller",
                type="Accessory",
                compatibility="PlayStation 5",
            ),
        ]
    )
    db_session.commit()

    device_response = auth_client.get("/api/hardware-reference-entries", params={"type": "Device"})
    assert [e["officialName"] for e in device_response.json()] == ["Sony PlayStation 5"]

    accessory_response = auth_client.get("/api/hardware-reference-entries", params={"type": "Accessory"})
    assert [e["officialName"] for e in accessory_response.json()] == ["Sony DualSense"]

    all_response = auth_client.get("/api/hardware-reference-entries")
    assert len(all_response.json()) == 2


def test_list_hardware_reference_entries_returns_full_fields(auth_client, db_session):
    db_session.add(_entry())
    db_session.commit()

    response = auth_client.get("/api/hardware-reference-entries")

    [entry] = response.json()
    assert entry["brand"] == "Sony"
    assert entry["family"] == "PlayStation"
    assert entry["generation"] == "PlayStation 5"
    assert entry["generationShort"] == "PS5"
    assert entry["category"] == "Console"
    assert entry["releaseDate"] == "2020-11-12"
    assert entry["discontinued"] is False
    assert entry["summary"] == "A console."
