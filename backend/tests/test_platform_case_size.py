"""Platform case sizes (Bookshelf mode): the actual physical case size a
user picks for a system renders its cases at a fixed 40%."""


def _get_platform(auth_client, platform_id):
    response = auth_client.get(f"/api/platforms/{platform_id}")
    assert response.status_code == 200
    return response.json()


def test_set_and_clear_platform_case_size(auth_client, seed_platform):
    platform = _get_platform(auth_client, seed_platform.id)
    assert platform["caseHeightMm"] is None
    assert platform["caseSpineMm"] is None

    response = auth_client.put(
        f"/api/platforms/{platform['id']}/case-size",
        json={"heightMm": 184, "spineMm": 25},
    )
    assert response.status_code == 200
    assert response.json()["caseHeightMm"] == 184
    assert response.json()["caseSpineMm"] == 25

    [listed] = [p for p in auth_client.get("/api/platforms").json() if p["id"] == platform["id"]]
    assert listed["caseHeightMm"] == 184
    assert listed["caseSpineMm"] == 25

    response = auth_client.put(
        f"/api/platforms/{platform['id']}/case-size", json={"heightMm": None, "spineMm": None}
    )
    assert response.status_code == 200
    assert response.json()["caseHeightMm"] is None
    assert response.json()["caseSpineMm"] is None


def test_set_platform_case_size_404_for_missing_platform(auth_client):
    response = auth_client.put(
        "/api/platforms/999999/case-size", json={"heightMm": 184, "spineMm": 25}
    )
    assert response.status_code == 404
