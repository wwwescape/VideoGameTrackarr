from app.models.catalog import Game, GameCategory
from app.models.library import LibraryItem, LibraryStatus


def _make_game(db_session, name, cover_url=None, hide_from_public=False):
    game = Game(
        name=name,
        category=GameCategory.MAIN_GAME,
        cover_url=cover_url,
        hide_from_public=hide_from_public,
    )
    db_session.add(game)
    db_session.commit()
    return game


def test_slides_requires_auth(client, db_session):
    response = client.get("/api/display-mode/slides")

    assert response.status_code == 401


def test_slides_empty_library_returns_empty_list(auth_client):
    response = auth_client.get("/api/display-mode/slides")

    assert response.status_code == 200
    assert response.json() == []


def test_slides_returns_only_owned_visible_games_with_covers(auth_client, db_session):
    owned = _make_game(db_session, "Owned Game", cover_url="https://example.com/a.jpg")
    db_session.add(LibraryItem(game_id=owned.id, status=LibraryStatus.OWNED))
    wishlisted = _make_game(db_session, "Wishlisted Game", cover_url="https://example.com/b.jpg")
    db_session.add(LibraryItem(game_id=wishlisted.id, status=LibraryStatus.WISHLIST))
    no_cover = _make_game(db_session, "No Cover Game")
    db_session.add(LibraryItem(game_id=no_cover.id, status=LibraryStatus.OWNED))
    hidden = _make_game(
        db_session, "Hidden Game", cover_url="https://example.com/c.jpg", hide_from_public=True
    )
    db_session.add(LibraryItem(game_id=hidden.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get("/api/display-mode/slides")

    assert response.status_code == 200
    slides = response.json()
    assert len(slides) == 1
    assert slides[0]["name"] == "Owned Game"
    assert slides[0]["mediaType"] == "cover_art"
    assert slides[0]["mediaUrl"] == "https://example.com/a.jpg"
    assert slides[0]["id"] == owned.id


def test_slides_respects_limit(auth_client, db_session):
    for i in range(5):
        game = _make_game(db_session, f"Game {i}", cover_url=f"https://example.com/{i}.jpg")
        db_session.add(LibraryItem(game_id=game.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get("/api/display-mode/slides", params={"limit": 3})

    assert response.status_code == 200
    assert len(response.json()) == 3


def test_slides_includes_hidden_and_wishlisted_when_allowed(auth_client, db_session):
    hidden = _make_game(
        db_session, "Hidden Game", cover_url="https://example.com/h.jpg", hide_from_public=True
    )
    db_session.add(LibraryItem(game_id=hidden.id, status=LibraryStatus.OWNED))
    wishlisted = _make_game(db_session, "Wishlisted Game", cover_url="https://example.com/w.jpg")
    db_session.add(LibraryItem(game_id=wishlisted.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    auth_client.put(
        "/api/settings/display-mode",
        json={"showHidden": True, "showWishlisted": True},
    )
    response = auth_client.get("/api/display-mode/slides")

    assert response.status_code == 200
    names = {slide["name"] for slide in response.json()}
    assert names == {"Hidden Game", "Wishlisted Game"}


def test_display_mode_settings_defaults(auth_client):
    response = auth_client.get("/api/settings/display-mode")

    assert response.status_code == 200
    assert response.json() == {
        "slideIntervalSeconds": 10,
        "showTitle": False,
        "showHidden": False,
        "showWishlisted": False,
        "mediaCoverArt": True,
        "mediaScreenshots": True,
        "mediaArtwork": True,
        "mediaVideos": True,
        "volume": 80,
    }


def test_display_mode_settings_update(auth_client):
    response = auth_client.put(
        "/api/settings/display-mode",
        json={
            "slideIntervalSeconds": 30,
            "showTitle": False,
            "showHidden": True,
            "showWishlisted": True,
            "mediaCoverArt": False,
            "mediaScreenshots": False,
            "mediaArtwork": False,
            "mediaVideos": False,
            "volume": 42,
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "slideIntervalSeconds": 30,
        "showTitle": False,
        "showHidden": True,
        "showWishlisted": True,
        "mediaCoverArt": False,
        "mediaScreenshots": False,
        "mediaArtwork": False,
        "mediaVideos": False,
        "volume": 42,
    }

    # Persisted
    again = auth_client.get("/api/settings/display-mode")
    assert again.json() == {
        "slideIntervalSeconds": 30,
        "showTitle": False,
        "showHidden": True,
        "showWishlisted": True,
        "mediaCoverArt": False,
        "mediaScreenshots": False,
        "mediaArtwork": False,
        "mediaVideos": False,
        "volume": 42,
    }


def test_display_mode_settings_rejects_out_of_range_interval(auth_client):
    response = auth_client.put(
        "/api/settings/display-mode", json={"slideIntervalSeconds": 2}
    )

    assert response.status_code == 422


def test_slides_include_screenshots_artworks_and_videos(auth_client, db_session):
    from app.models.catalog import Artwork, GameVideo, Screenshot

    game = _make_game(db_session, "Media Game", cover_url="https://example.com/cover.jpg")
    db_session.add(LibraryItem(game_id=game.id, status=LibraryStatus.OWNED))
    db_session.add(Screenshot(game_id=game.id, url="https://example.com/shot.jpg"))
    db_session.add(Artwork(game_id=game.id, url="https://example.com/art.jpg"))
    db_session.add(GameVideo(game_id=game.id, video_id="abc123"))
    db_session.commit()

    response = auth_client.get("/api/display-mode/slides")

    assert response.status_code == 200
    slides = response.json()
    by_type = {slide["mediaType"]: slide["mediaUrl"] for slide in slides}
    assert by_type["cover_art"] == "https://example.com/cover.jpg"
    assert by_type["screenshot"] == "https://example.com/shot.jpg"
    assert by_type["artwork"] == "https://example.com/art.jpg"
    assert by_type["video"].startswith("https://www.youtube.com/embed/abc123")
    assert all(slide["name"] == "Media Game" for slide in slides)


def test_slides_exclude_disabled_media_types(auth_client, db_session):
    from app.models.catalog import Screenshot

    game = _make_game(db_session, "Media Game", cover_url="https://example.com/cover.jpg")
    db_session.add(LibraryItem(game_id=game.id, status=LibraryStatus.OWNED))
    db_session.add(Screenshot(game_id=game.id, url="https://example.com/shot.jpg"))
    db_session.commit()

    auth_client.put(
        "/api/settings/display-mode",
        json={"mediaCoverArt": False, "mediaScreenshots": False, "mediaVideos": False},
    )
    response = auth_client.get("/api/display-mode/slides")

    assert response.status_code == 200
    assert response.json() == []


def test_slides_only_videos_when_others_disabled(auth_client, db_session):
    from app.models.catalog import GameVideo

    game = _make_game(db_session, "Video Game", cover_url="https://example.com/cover.jpg")
    db_session.add(LibraryItem(game_id=game.id, status=LibraryStatus.OWNED))
    db_session.add(GameVideo(game_id=game.id, video_id="xyz789"))
    db_session.commit()

    auth_client.put(
        "/api/settings/display-mode",
        json={"mediaCoverArt": False, "mediaScreenshots": False, "mediaArtwork": False},
    )
    response = auth_client.get("/api/display-mode/slides")

    assert response.status_code == 200
    slides = response.json()
    assert len(slides) == 1
    assert slides[0]["mediaType"] == "video"


def test_display_mode_volume_is_clamped(auth_client):
    response = auth_client.put("/api/settings/display-mode", json={"volume": 150})
    assert response.status_code == 200
    assert response.json()["volume"] == 100

    response = auth_client.put("/api/settings/display-mode", json={"volume": -5})
    # -5 fails the ge=0 validation
    assert response.status_code == 422
