def test_create_manual_game_requires_auth(client):
    response = client.post("/api/games/manual", json={"name": "My Homebrew Game"})

    assert response.status_code == 401


def test_create_manual_game_minimal(auth_client):
    response = auth_client.post("/api/games/manual", json={"name": "My Homebrew Game"})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "My Homebrew Game"
    assert body["igdbId"] is None
    assert body["category"] == "main_game"


def test_create_manual_game_with_all_fields(auth_client):
    response = auth_client.post(
        "/api/games/manual",
        json={
            "name": "Indie Gem",
            "category": "dlc_addon",
            "firstReleaseDate": 1700000000,
            "summary": "A neat little game.",
            "coverUrl": "https://example.com/cover.jpg",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["category"] == "dlc_addon"
    assert body["firstReleaseDate"] == 1700000000
    assert body["summary"] == "A neat little game."
    assert body["coverUrl"] == "https://example.com/cover.jpg"


def test_create_manual_game_rejects_empty_name(auth_client):
    response = auth_client.post("/api/games/manual", json={"name": ""})

    assert response.status_code == 422


def test_manual_game_appears_in_list(auth_client):
    auth_client.post("/api/games/manual", json={"name": "My Homebrew Game"})

    response = auth_client.get("/api/games")

    assert [g["name"] for g in response.json()] == ["My Homebrew Game"]


def test_create_manual_game_with_parent(auth_client, seed_game):
    response = auth_client.post(
        "/api/games/manual",
        json={"name": "Homebrew DLC", "category": "dlc_addon", "parentGameId": seed_game.id},
    )

    assert response.status_code == 201
    assert response.json()["parentGameId"] == seed_game.id


def test_create_manual_game_links_the_originating_steam_entry(auth_client, db_session):
    from app.models.steam import SteamLibraryEntry

    db_session.add(SteamLibraryEntry(steam_app_id=410700, steam_name="System Shock: Classic"))
    db_session.commit()

    response = auth_client.post(
        "/api/games/manual",
        json={"name": "System Shock: Classic", "steamAppId": 410700},
    )

    assert response.status_code == 201
    assert response.json()["steamAppId"] == 410700

    entry = db_session.query(SteamLibraryEntry).filter(SteamLibraryEntry.steam_app_id == 410700).first()
    assert entry.game_id == response.json()["id"]


def test_create_manual_game_with_unknown_steam_app_id_is_a_silent_no_op(auth_client):
    response = auth_client.post(
        "/api/games/manual",
        json={"name": "Some Game", "steamAppId": 999999999},
    )

    assert response.status_code == 201
    assert response.json()["steamAppId"] is None


def test_create_manual_game_without_steam_app_id_has_no_steam_link(auth_client):
    response = auth_client.post("/api/games/manual", json={"name": "My Homebrew Game"})

    assert response.status_code == 201
    assert response.json()["steamAppId"] is None


def test_create_manual_game_rejects_missing_parent(auth_client):
    response = auth_client.post(
        "/api/games/manual",
        json={"name": "Homebrew DLC", "category": "dlc_addon", "parentGameId": 999999},
    )

    assert response.status_code == 404


def test_create_manual_game_with_extended_fields(auth_client):
    response = auth_client.post(
        "/api/games/manual",
        json={
            "name": "Indie Gem",
            "storyline": "A tale of two pixels.",
            "edition": "Game of the Year Edition",
            "developedBy": ["Tiny Studio"],
            "publishedBy": ["Tiny Studio", "Big Publisher"],
            "platformNames": ["PC", "Switch"],
            "notes": "Picked this up on sale.",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["storyline"] == "A tale of two pixels."
    assert body["edition"] == "Game of the Year Edition"
    companies_by_role: dict[str, list[str]] = {}
    for company in body["companies"]:
        companies_by_role.setdefault(company["role"], []).append(company["name"])
    assert companies_by_role["developer"] == ["Tiny Studio"]
    assert sorted(companies_by_role["publisher"]) == ["Big Publisher", "Tiny Studio"]
    assert sorted(p["name"] for p in body["platforms"]) == ["PC", "Switch"]

    notes_response = auth_client.get(f"/api/games/{body['id']}/notes")
    assert [n["body"] for n in notes_response.json()] == ["Picked this up on sale."]


def test_create_manual_game_reuses_existing_company_by_name(auth_client):
    first = auth_client.post(
        "/api/games/manual", json={"name": "Game One", "developedBy": ["Shared Studio"]}
    ).json()
    second = auth_client.post(
        "/api/games/manual", json={"name": "Game Two", "developedBy": ["Shared Studio"]}
    ).json()

    first_company_id = next(c["id"] for c in first["companies"] if c["name"] == "Shared Studio")
    second_company_id = next(c["id"] for c in second["companies"] if c["name"] == "Shared Studio")
    assert first_company_id == second_company_id


def test_update_manual_game_requires_auth(client):
    response = client.patch("/api/games/1/manual", json={"name": "New Name"})

    assert response.status_code == 401


def test_update_manual_game_updates_fields(auth_client):
    created = auth_client.post(
        "/api/games/manual", json={"name": "My Homebrew Game", "developedBy": ["Tiny Studio"]}
    ).json()

    response = auth_client.patch(
        f"/api/games/{created['id']}/manual",
        json={
            "name": "My Homebrew Game (Remastered)",
            "summary": "Now with more pixels.",
            "developedBy": ["Tiny Studio", "Big Helper"],
            "platformNames": ["PC"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "My Homebrew Game (Remastered)"
    assert body["summary"] == "Now with more pixels."
    assert sorted(c["name"] for c in body["companies"]) == ["Big Helper", "Tiny Studio"]
    assert [p["name"] for p in body["platforms"]] == ["PC"]


def test_update_manual_game_can_clear_developed_by(auth_client):
    created = auth_client.post(
        "/api/games/manual", json={"name": "Game One", "developedBy": ["Tiny Studio"]}
    ).json()

    response = auth_client.patch(f"/api/games/{created['id']}/manual", json={"developedBy": []})

    assert response.status_code == 200
    assert response.json()["companies"] == []


def test_update_manual_game_rejects_igdb_linked_game(auth_client, seed_game):
    response = auth_client.patch(f"/api/games/{seed_game.id}/manual", json={"name": "Hacked Name"})

    assert response.status_code == 409


def test_update_manual_game_404_for_missing(auth_client):
    response = auth_client.patch("/api/games/999999/manual", json={"name": "Ghost Game"})

    assert response.status_code == 404


def test_update_manual_game_rejects_missing_parent(auth_client):
    created = auth_client.post("/api/games/manual", json={"name": "Homebrew DLC", "category": "dlc_addon"}).json()

    response = auth_client.patch(f"/api/games/{created['id']}/manual", json={"parentGameId": 999999})

    assert response.status_code == 404


def _upload_media(auth_client) -> str:
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (320, 180), color="blue").save(buf, format="PNG")
    response = auth_client.post("/api/uploads/game-media", files={"file": ("shot.png", buf.getvalue(), "image/png")})
    return response.json()["url"]


def _media_file(url: str):
    from app.services import upload_service

    return upload_service.GAME_MEDIA_DIR / url.removeprefix(upload_service.GAME_MEDIA_URL_PREFIX)


def test_create_manual_game_with_screenshots_artwork_and_videos(auth_client):
    shots = [_upload_media(auth_client), _upload_media(auth_client)]
    art = _upload_media(auth_client)

    response = auth_client.post(
        "/api/games/manual",
        json={
            "name": "Homebrew",
            "screenshotUrls": shots,
            "artworkUrls": [art],
            "videos": [{"name": "Trailer", "videoId": "dQw4w9WgXcQ"}, {"videoId": "abcdefghijk"}],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["screenshotUrls"] == shots
    assert body["artworkUrls"] == [art]
    assert [(v["name"], v["videoId"]) for v in body["videos"]] == [("Trailer", "dQw4w9WgXcQ"), (None, "abcdefghijk")]


def test_manual_game_media_must_be_uploads_and_at_most_ten(auth_client):
    elsewhere = auth_client.post(
        "/api/games/manual", json={"name": "A", "screenshotUrls": ["https://example.com/shot.jpg"]}
    )
    escape = auth_client.post("/api/games/manual", json={"name": "B", "artworkUrls": ["/uploads/game-media/../x.jpg"]})
    too_many = auth_client.post(
        "/api/games/manual", json={"name": "C", "screenshotUrls": [f"/uploads/game-media/{n}.jpg" for n in range(11)]}
    )
    bad_video = auth_client.post("/api/games/manual", json={"name": "D", "videos": [{"videoId": "not a video id"}]})

    assert elsewhere.status_code == escape.status_code == too_many.status_code == 409
    assert bad_video.status_code == 422


def test_update_manual_game_reorders_and_deletes_removed_media(auth_client):
    first, second, third = (_upload_media(auth_client) for _ in range(3))
    created = auth_client.post(
        "/api/games/manual", json={"name": "Homebrew", "artworkUrls": [first, second, third]}
    ).json()

    response = auth_client.patch(f"/api/games/{created['id']}/manual", json={"artworkUrls": [third, first]})

    assert response.status_code == 200
    assert response.json()["artworkUrls"] == [third, first]
    assert not _media_file(second).exists()
    assert _media_file(first).exists() and _media_file(third).exists()


def test_update_manual_game_keeps_more_than_ten_images_it_already_had(auth_client, db_session):
    """A game unlinked from IGDB keeps IGDB's screenshots, possibly more than ten: it can keep
    or remove them, but not add more."""
    from app.models.catalog import Game, Screenshot

    game = Game(name="Unlinked")
    db_session.add(game)
    db_session.flush()
    igdb_urls = [f"https://images.igdb.com/igdb/image/upload/t_1080p/sc{n}.jpg" for n in range(12)]
    db_session.add_all(Screenshot(game_id=game.id, igdb_id=900 + n, url=url) for n, url in enumerate(igdb_urls))
    db_session.commit()

    kept = auth_client.patch(f"/api/games/{game.id}/manual", json={"screenshotUrls": igdb_urls[1:]})
    added = auth_client.patch(
        f"/api/games/{game.id}/manual", json={"screenshotUrls": [*igdb_urls[1:], _upload_media(auth_client)]}
    )

    assert kept.status_code == 200
    assert kept.json()["screenshotUrls"] == igdb_urls[1:]
    assert added.status_code == 409


def test_replacing_a_cover_and_deleting_a_custom_game_remove_its_uploads(auth_client):
    from app.services import upload_service

    def cover_upload() -> str:
        import io

        from PIL import Image

        buf = io.BytesIO()
        Image.new("RGB", (100, 140), color="red").save(buf, format="PNG")
        return auth_client.post("/api/uploads/covers", files={"file": ("c.png", buf.getvalue(), "image/png")}).json()[
            "url"
        ]

    def cover_file(url: str):
        return upload_service.COVERS_DIR / url.removeprefix(upload_service.COVERS_URL_PREFIX)

    old_cover, new_cover, shot = cover_upload(), cover_upload(), _upload_media(auth_client)
    created = auth_client.post(
        "/api/games/manual", json={"name": "Homebrew", "coverUrl": old_cover, "screenshotUrls": [shot]}
    ).json()

    auth_client.patch(f"/api/games/{created['id']}/manual", json={"coverUrl": new_cover})
    assert not cover_file(old_cover).exists()

    assert auth_client.delete(f"/api/games/{created['id']}").status_code == 204
    assert not cover_file(new_cover).exists()
    assert not _media_file(shot).exists()
