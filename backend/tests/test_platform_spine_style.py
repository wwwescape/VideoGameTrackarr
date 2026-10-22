"""Platform generic-spine styling (Bookshelf mode): per-platform colour and
icon for the default spines."""


def _get_platform(auth_client, platform_id):
    response = auth_client.get(f"/api/platforms/{platform_id}")
    assert response.status_code == 200
    return response.json()


def test_set_and_clear_platform_spine_style(auth_client, seed_platform):
    platform = _get_platform(auth_client, seed_platform.id)
    assert platform["spineColor"] is None
    assert platform["spineIcon"] is None

    response = auth_client.put(
        f"/api/platforms/{platform['id']}/spine-style",
        json={"color": "#e60012", "icon": "gamepad"},
    )
    assert response.status_code == 200
    assert response.json()["spineColor"] == "#e60012"
    assert response.json()["spineIcon"] == "gamepad"

    [listed] = [p for p in auth_client.get("/api/platforms").json() if p["id"] == platform["id"]]
    assert listed["spineColor"] == "#e60012"
    assert listed["spineIcon"] == "gamepad"

    response = auth_client.put(
        f"/api/platforms/{platform['id']}/spine-style", json={"color": None, "icon": None}
    )
    assert response.status_code == 200
    assert response.json()["spineColor"] is None
    assert response.json()["spineIcon"] is None


def test_spine_style_rejects_bad_colour(auth_client, seed_platform):
    platform = _get_platform(auth_client, seed_platform.id)
    response = auth_client.put(
        f"/api/platforms/{platform['id']}/spine-style", json={"color": "red", "icon": None}
    )
    assert response.status_code == 422


def test_set_platform_spine_style_404_for_missing_platform(auth_client):
    response = auth_client.put(
        "/api/platforms/999999/spine-style", json={"color": "#000000", "icon": "disc"}
    )
    assert response.status_code == 404


def test_custom_uploaded_icon_url_round_trips_and_clears(auth_client, seed_platform):
    platform = _get_platform(auth_client, seed_platform.id)
    response = auth_client.put(
        f"/api/platforms/{platform['id']}/spine-style",
        json={"color": None, "icon": "custom", "iconUrl": "/uploads/spines/icon.png"},
    )
    assert response.status_code == 200
    assert response.json()["spineIcon"] == "custom"
    assert response.json()["spineIconUrl"] == "/uploads/spines/icon.png"

    # Picking a built-in icon clears the uploaded image reference.
    response = auth_client.put(
        f"/api/platforms/{platform['id']}/spine-style",
        json={"color": None, "icon": "disc", "iconUrl": "/uploads/spines/icon.png"},
    )
    assert response.status_code == 200
    assert response.json()["spineIconUrl"] is None
