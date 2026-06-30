def test_list_platforms_requires_auth(client):
    response = client.get("/api/platforms")

    assert response.status_code == 401


def test_list_platforms_returns_seeded_platform(auth_client, seed_platform):
    response = auth_client.get("/api/platforms")

    assert response.status_code == 200
    body = response.json()
    assert body == [
        {"id": seed_platform.id, "igdbId": None, "name": "PlayStation 5", "slug": "ps5", "abbreviation": None}
    ]


def test_list_regions_requires_auth(client):
    response = client.get("/api/regions")

    assert response.status_code == 401


def test_list_regions_returns_seeded_region(auth_client, seed_region):
    response = auth_client.get("/api/regions")

    assert response.status_code == 200
    assert response.json() == [{"id": seed_region.id, "name": "PAL"}]
