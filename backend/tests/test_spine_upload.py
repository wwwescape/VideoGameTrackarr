"""Spine image upload (Bookshelf mode platform templates / custom icons):
aspect-preserving storage under /uploads/spines/, downscale-only."""

from io import BytesIO

from PIL import Image


def _jpeg_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (60, 400), color=(30, 30, 120)).save(buffer, format="JPEG")
    return buffer.getvalue()


def test_upload_spine_returns_servable_url(auth_client):
    response = auth_client.post(
        "/api/uploads/spines", files={"file": ("spine.png", _jpeg_bytes(), "image/jpeg")}
    )
    assert response.status_code == 201
    assert response.json()["url"].startswith("/uploads/spines/")


def test_upload_spine_downscales_oversized_image(auth_client):
    # Regression: the downscale branch (long edge > SPINE_MAX_EDGE) once called
    # Image.thumbnail() with a `method=` kwarg Pillow doesn't accept — small
    # test images never reached that branch, so it shipped broken and only a
    # real full-size upload (e.g. a platform template) hit the 500.
    buffer = BytesIO()
    Image.new("RGB", (100, 2000), color=(10, 90, 10)).save(buffer, format="JPEG")

    response = auth_client.post(
        "/api/uploads/spines", files={"file": ("big.jpg", buffer.getvalue(), "image/jpeg")}
    )
    assert response.status_code == 201
    url = response.json()["url"]

    from app.core.config import UPLOADS_DIR

    with Image.open(UPLOADS_DIR / "spines" / url.rsplit("/", 1)[-1]) as stored:
        assert max(stored.size) == 1200


def test_upload_spine_preserves_transparency_as_png(auth_client):
    # Regression: a platform logo uploaded as a spine icon is a transparent
    # PNG, but the saver flattened everything through JPEG — convert("RGB")
    # drops the alpha channel and the raw RGB under transparent pixels is
    # usually black, so logos rendered with a black box around the glyph.
    buffer = BytesIO()
    logo = Image.new("RGBA", (60, 60), color=(0, 0, 0, 0))
    for x in range(20, 40):
        for y in range(15, 45):
            logo.putpixel((x, y), (255, 255, 255, 255))
    logo.save(buffer, format="PNG")

    response = auth_client.post(
        "/api/uploads/spines", files={"file": ("logo.png", buffer.getvalue(), "image/png")}
    )
    assert response.status_code == 201
    url = response.json()["url"]
    assert url.endswith(".png")

    from app.core.config import UPLOADS_DIR

    with Image.open(UPLOADS_DIR / "spines" / url.rsplit("/", 1)[-1]) as stored:
        assert stored.mode == "RGBA"
        assert stored.getpixel((0, 0))[3] == 0
        assert stored.getpixel((30, 30)) == (255, 255, 255, 255)


def test_upload_spine_fully_opaque_rgba_still_jpeg(auth_client):
    # An alpha channel that never actually goes transparent changes nothing:
    # opaque uploads keep the JPEG encoding spine scans have always used.
    buffer = BytesIO()
    Image.new("RGBA", (60, 400), color=(30, 30, 120, 255)).save(buffer, format="PNG")

    response = auth_client.post(
        "/api/uploads/spines", files={"file": ("spine.png", buffer.getvalue(), "image/png")}
    )
    assert response.status_code == 201
    assert response.json()["url"].endswith(".jpg")


def test_upload_spine_rejects_non_image(auth_client):
    response = auth_client.post(
        "/api/uploads/spines", files={"file": ("spine.png", b"not an image", "image/png")}
    )
    assert response.status_code == 400
