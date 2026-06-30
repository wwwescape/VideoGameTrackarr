from app.main import resolve_static_file


def test_resolve_static_file_returns_existing_file(tmp_path):
    (tmp_path / "manifest.webmanifest").write_text("{}")

    result = resolve_static_file(tmp_path, "manifest.webmanifest")

    assert result == tmp_path / "manifest.webmanifest"


def test_resolve_static_file_returns_none_for_unknown_path(tmp_path):
    # An SPA client-side route like /dashboard isn't a real file on disk - the caller falls
    # back to index.html in that case.
    assert resolve_static_file(tmp_path, "dashboard") is None


def test_resolve_static_file_returns_none_for_empty_path(tmp_path):
    assert resolve_static_file(tmp_path, "") is None


def test_resolve_static_file_blocks_path_traversal(tmp_path):
    base_dir = tmp_path / "build"
    base_dir.mkdir()
    secret = tmp_path / "secret.txt"
    secret.write_text("should never be served")

    result = resolve_static_file(base_dir, "../secret.txt")

    assert result is None


def test_resolve_static_file_blocks_absolute_path_escape(tmp_path):
    base_dir = tmp_path / "build"
    base_dir.mkdir()
    secret = tmp_path / "secret.txt"
    secret.write_text("should never be served")

    result = resolve_static_file(base_dir, str(secret))

    assert result is None
