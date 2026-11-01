import io

from PIL import Image

from app.services import upload_service


def _image_bytes(size: tuple[int, int] = (100, 140), image_format: str = "PNG") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color="red").save(buf, format=image_format)
    return buf.getvalue()


def test_upload_cover_requires_auth(client):
    response = client.post(
        "/api/uploads/covers", files={"file": ("cover.png", io.BytesIO(_image_bytes()), "image/png")}
    )

    assert response.status_code == 401


def test_upload_cover_saves_and_returns_url(auth_client):
    response = auth_client.post(
        "/api/uploads/covers", files={"file": ("cover.png", io.BytesIO(_image_bytes()), "image/png")}
    )

    assert response.status_code == 201
    url = response.json()["url"]
    assert url.startswith("/uploads/covers/")
    assert url.endswith(".jpg")

    saved_path = upload_service.COVERS_DIR / url.removeprefix("/uploads/covers/")
    assert saved_path.is_file()
    with Image.open(saved_path) as saved:
        assert saved.format == "JPEG"
    saved_path.unlink()


def test_upload_cover_crops_to_target_size(auth_client):
    response = auth_client.post(
        "/api/uploads/covers",
        files={"file": ("cover.png", io.BytesIO(_image_bytes(size=(3000, 4000))), "image/png")},
    )

    assert response.status_code == 201
    url = response.json()["url"]
    saved_path = upload_service.COVERS_DIR / url.removeprefix("/uploads/covers/")
    with Image.open(saved_path) as saved:
        assert saved.size == (540, 720)
    saved_path.unlink()


def test_upload_cover_crops_undersized_image_to_target_size(auth_client):
    response = auth_client.post(
        "/api/uploads/covers",
        files={"file": ("cover.png", io.BytesIO(_image_bytes(size=(100, 140))), "image/png")},
    )

    assert response.status_code == 201
    url = response.json()["url"]
    saved_path = upload_service.COVERS_DIR / url.removeprefix("/uploads/covers/")
    with Image.open(saved_path) as saved:
        assert saved.size == (540, 720)
    saved_path.unlink()


def test_upload_cover_rejects_non_image_file(auth_client):
    response = auth_client.post(
        "/api/uploads/covers", files={"file": ("notes.txt", io.BytesIO(b"not an image"), "text/plain")}
    )

    assert response.status_code == 400


def test_upload_accessory_image_requires_auth(client):
    response = client.post(
        "/api/uploads/accessory-images", files={"file": ("image.png", io.BytesIO(_image_bytes()), "image/png")}
    )

    assert response.status_code == 401


def test_upload_accessory_image_saves_and_returns_url(auth_client):
    response = auth_client.post(
        "/api/uploads/accessory-images", files={"file": ("image.png", io.BytesIO(_image_bytes()), "image/png")}
    )

    assert response.status_code == 201
    url = response.json()["url"]
    assert url.startswith("/uploads/accessory-images/")
    assert url.endswith(".jpg")

    saved_path = upload_service.ACCESSORY_IMAGES_DIR / url.removeprefix("/uploads/accessory-images/")
    assert saved_path.is_file()
    with Image.open(saved_path) as saved:
        assert saved.format == "JPEG"
        assert saved.size == (400, 400)
    saved_path.unlink()


def test_upload_accessory_image_rejects_non_image_file(auth_client):
    response = auth_client.post(
        "/api/uploads/accessory-images", files={"file": ("notes.txt", io.BytesIO(b"not an image"), "text/plain")}
    )

    assert response.status_code == 400


def test_upload_cover_refuses_formats_outside_the_allow_list(auth_client):
    # TIFF is a perfectly valid image, but not one of the formats uploads are decoded as.
    response = auth_client.post(
        "/api/uploads/covers",
        files={"file": ("cover.tiff", io.BytesIO(_image_bytes(image_format="TIFF")), "image/tiff")},
    )

    assert response.status_code == 400
    assert "JPEG, PNG, WebP or GIF" in response.json()["detail"]


def test_upload_cover_accepts_webp(auth_client):
    response = auth_client.post(
        "/api/uploads/covers",
        files={"file": ("cover.webp", io.BytesIO(_image_bytes(image_format="WEBP")), "image/webp")},
    )

    assert response.status_code == 201


def test_upload_cover_refuses_an_oversized_file(auth_client, monkeypatch):
    from app.services import upload_service

    monkeypatch.setattr(upload_service, "MAX_IMAGE_UPLOAD_BYTES", 100)
    response = auth_client.post(
        "/api/uploads/covers", files={"file": ("cover.png", io.BytesIO(_image_bytes()), "image/png")}
    )

    assert response.status_code == 413


def test_upload_game_media_keeps_its_shape_and_only_shrinks(auth_client):
    wide = auth_client.post(
        "/api/uploads/game-media", files={"file": ("shot.png", io.BytesIO(_image_bytes((3840, 2160))), "image/png")}
    )
    small = auth_client.post(
        "/api/uploads/game-media", files={"file": ("shot.png", io.BytesIO(_image_bytes((640, 480))), "image/png")}
    )

    assert wide.status_code == small.status_code == 201
    wide_url, small_url = wide.json()["url"], small.json()["url"]
    assert wide_url.startswith(upload_service.GAME_MEDIA_URL_PREFIX)

    def saved(url: str):
        return upload_service.GAME_MEDIA_DIR / url.removeprefix(upload_service.GAME_MEDIA_URL_PREFIX)

    with Image.open(saved(wide_url)) as image:
        assert image.size == (1920, 1080)
    with Image.open(saved(small_url)) as image:
        assert image.size == (640, 480)


def test_upload_game_media_requires_auth(client):
    response = client.post(
        "/api/uploads/game-media", files={"file": ("shot.png", io.BytesIO(_image_bytes()), "image/png")}
    )

    assert response.status_code == 401
