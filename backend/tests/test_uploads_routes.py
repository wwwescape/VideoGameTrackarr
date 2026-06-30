import io

from PIL import Image

from app.core.config import UPLOADS_DIR


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

    saved_path = UPLOADS_DIR / "covers" / url.removeprefix("/uploads/covers/")
    assert saved_path.is_file()
    with Image.open(saved_path) as saved:
        assert saved.format == "JPEG"
    saved_path.unlink()


def test_upload_cover_resizes_oversized_image(auth_client):
    response = auth_client.post(
        "/api/uploads/covers",
        files={"file": ("cover.png", io.BytesIO(_image_bytes(size=(3000, 4000))), "image/png")},
    )

    assert response.status_code == 201
    url = response.json()["url"]
    saved_path = UPLOADS_DIR / "covers" / url.removeprefix("/uploads/covers/")
    with Image.open(saved_path) as saved:
        assert saved.width <= 960
        assert saved.height <= 1280
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

    saved_path = UPLOADS_DIR / "accessory-images" / url.removeprefix("/uploads/accessory-images/")
    assert saved_path.is_file()
    with Image.open(saved_path) as saved:
        assert saved.format == "JPEG"
    saved_path.unlink()


def test_upload_accessory_image_rejects_non_image_file(auth_client):
    response = auth_client.post(
        "/api/uploads/accessory-images", files={"file": ("notes.txt", io.BytesIO(b"not an image"), "text/plain")}
    )

    assert response.status_code == 400
