def test_list_tags_requires_auth(client):
    response = client.get("/api/tags")

    assert response.status_code == 401


def test_create_and_list_tags(auth_client):
    response = auth_client.post("/api/tags", json={"name": "Couch Co-op", "color": "#7C4DFF"})

    assert response.status_code == 201
    assert response.json()["name"] == "Couch Co-op"
    assert response.json()["color"] == "#7C4DFF"

    list_response = auth_client.get("/api/tags")
    assert [tag["name"] for tag in list_response.json()] == ["Couch Co-op"]


def test_create_tag_is_idempotent_by_name(auth_client):
    first = auth_client.post("/api/tags", json={"name": "Backlog", "color": None})
    second = auth_client.post("/api/tags", json={"name": "Backlog", "color": None})

    assert first.json()["id"] == second.json()["id"]
    assert len(auth_client.get("/api/tags").json()) == 1


def test_delete_tag(auth_client):
    create_response = auth_client.post("/api/tags", json={"name": "Temp"})
    tag_id = create_response.json()["id"]

    response = auth_client.delete(f"/api/tags/{tag_id}")

    assert response.status_code == 204
    assert auth_client.get("/api/tags").json() == []


def test_delete_tag_404_for_missing_tag(auth_client):
    response = auth_client.delete("/api/tags/999999")

    assert response.status_code == 404


def test_attach_and_detach_tag_on_game(auth_client, seed_game):
    tag_id = auth_client.post("/api/tags", json={"name": "Speedrun"}).json()["id"]

    attach_response = auth_client.post(f"/api/games/{seed_game.id}/tags/{tag_id}")
    assert attach_response.status_code == 200
    assert [tag["name"] for tag in attach_response.json()] == ["Speedrun"]

    detail_response = auth_client.get(f"/api/games/{seed_game.slug}")
    assert [tag["name"] for tag in detail_response.json()["tags"]] == ["Speedrun"]

    detach_response = auth_client.delete(f"/api/games/{seed_game.id}/tags/{tag_id}")
    assert detach_response.json() == []


def test_attach_tag_is_idempotent(auth_client, seed_game):
    tag_id = auth_client.post("/api/tags", json={"name": "Speedrun"}).json()["id"]

    auth_client.post(f"/api/games/{seed_game.id}/tags/{tag_id}")
    response = auth_client.post(f"/api/games/{seed_game.id}/tags/{tag_id}")

    assert len(response.json()) == 1


def test_attach_tag_404_for_missing_game(auth_client):
    tag_id = auth_client.post("/api/tags", json={"name": "Speedrun"}).json()["id"]

    response = auth_client.post(f"/api/games/999999/tags/{tag_id}")

    assert response.status_code == 404


def test_attach_tag_404_for_missing_tag(auth_client, seed_game):
    response = auth_client.post(f"/api/games/{seed_game.id}/tags/999999")

    assert response.status_code == 404


def test_deleting_tag_removes_it_from_games(auth_client, seed_game):
    tag_id = auth_client.post("/api/tags", json={"name": "Speedrun"}).json()["id"]
    auth_client.post(f"/api/games/{seed_game.id}/tags/{tag_id}")

    auth_client.delete(f"/api/tags/{tag_id}")

    detail_response = auth_client.get(f"/api/games/{seed_game.slug}")
    assert detail_response.json()["tags"] == []


def test_attach_and_detach_tag_on_device(auth_client, seed_device):
    tag_id = auth_client.post("/api/tags", json={"name": "Modded"}).json()["id"]

    attach_response = auth_client.post(f"/api/devices/{seed_device.id}/tags/{tag_id}")
    assert attach_response.status_code == 200
    assert [tag["name"] for tag in attach_response.json()] == ["Modded"]

    detail_response = auth_client.get(f"/api/devices/{seed_device.uuid}")
    assert [tag["name"] for tag in detail_response.json()["tags"]] == ["Modded"]

    detach_response = auth_client.delete(f"/api/devices/{seed_device.id}/tags/{tag_id}")
    assert detach_response.json() == []


def test_attach_tag_to_device_is_idempotent(auth_client, seed_device):
    tag_id = auth_client.post("/api/tags", json={"name": "Modded"}).json()["id"]

    auth_client.post(f"/api/devices/{seed_device.id}/tags/{tag_id}")
    response = auth_client.post(f"/api/devices/{seed_device.id}/tags/{tag_id}")

    assert len(response.json()) == 1


def test_attach_tag_to_device_404_for_missing_device(auth_client):
    tag_id = auth_client.post("/api/tags", json={"name": "Modded"}).json()["id"]

    response = auth_client.post(f"/api/devices/999999/tags/{tag_id}")

    assert response.status_code == 404


def test_attach_tag_to_device_404_for_missing_tag(auth_client, seed_device):
    response = auth_client.post(f"/api/devices/{seed_device.id}/tags/999999")

    assert response.status_code == 404


def test_deleting_tag_removes_it_from_devices(auth_client, seed_device):
    tag_id = auth_client.post("/api/tags", json={"name": "Modded"}).json()["id"]
    auth_client.post(f"/api/devices/{seed_device.id}/tags/{tag_id}")

    auth_client.delete(f"/api/tags/{tag_id}")

    detail_response = auth_client.get(f"/api/devices/{seed_device.uuid}")
    assert detail_response.json()["tags"] == []


def test_attach_and_detach_tag_on_accessory(auth_client, seed_accessory):
    tag_id = auth_client.post("/api/tags", json={"name": "For Sale"}).json()["id"]

    attach_response = auth_client.post(f"/api/accessories/{seed_accessory.id}/tags/{tag_id}")
    assert attach_response.status_code == 200
    assert [tag["name"] for tag in attach_response.json()] == ["For Sale"]

    detail_response = auth_client.get(f"/api/accessories/{seed_accessory.uuid}")
    assert [tag["name"] for tag in detail_response.json()["tags"]] == ["For Sale"]

    detach_response = auth_client.delete(f"/api/accessories/{seed_accessory.id}/tags/{tag_id}")
    assert detach_response.json() == []


def test_attach_tag_to_accessory_is_idempotent(auth_client, seed_accessory):
    tag_id = auth_client.post("/api/tags", json={"name": "For Sale"}).json()["id"]

    auth_client.post(f"/api/accessories/{seed_accessory.id}/tags/{tag_id}")
    response = auth_client.post(f"/api/accessories/{seed_accessory.id}/tags/{tag_id}")

    assert len(response.json()) == 1


def test_attach_tag_to_accessory_404_for_missing_accessory(auth_client):
    tag_id = auth_client.post("/api/tags", json={"name": "For Sale"}).json()["id"]

    response = auth_client.post(f"/api/accessories/999999/tags/{tag_id}")

    assert response.status_code == 404


def test_attach_tag_to_accessory_404_for_missing_tag(auth_client, seed_accessory):
    response = auth_client.post(f"/api/accessories/{seed_accessory.id}/tags/999999")

    assert response.status_code == 404


def test_deleting_tag_removes_it_from_accessories(auth_client, seed_accessory):
    tag_id = auth_client.post("/api/tags", json={"name": "For Sale"}).json()["id"]
    auth_client.post(f"/api/accessories/{seed_accessory.id}/tags/{tag_id}")

    auth_client.delete(f"/api/tags/{tag_id}")

    detail_response = auth_client.get(f"/api/accessories/{seed_accessory.uuid}")
    assert detail_response.json()["tags"] == []
