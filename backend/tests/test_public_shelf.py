"""Game Shelf: the share page's read-only shelf, GET /api/public/{token}/shelf."""

from app.models.catalog import Game, GameCategory, Platform
from app.models.library import LibraryItem, LibraryStatus, MediaFormat


def _token(auth_client) -> str:
    return auth_client.post("/api/share-link").json()["token"]


def _seed(db_session):
    ps5 = Platform(name="PlayStation 5", slug="ps5", igdb_id=167)
    db_session.add(ps5)
    db_session.flush()
    games = {}
    for name, released, fmt in (("Bravo", 100, MediaFormat.PHYSICAL), ("Alpha", 300, MediaFormat.PHYSICAL)):
        game = Game(name=name, slug=name.lower(), category=GameCategory.MAIN_GAME, first_release_date=released)
        db_session.add(game)
        db_session.flush()
        db_session.add(
            LibraryItem(game_id=game.id, platform_id=ps5.id, status=LibraryStatus.OWNED, format=fmt, steelbook=True)
        )
        games[name] = game
    digital = Game(name="Digital", category=GameCategory.MAIN_GAME)
    db_session.add(digital)
    db_session.flush()
    db_session.add(
        LibraryItem(
            game_id=digital.id,
            platform_id=ps5.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.DIGITAL,
            digital_storefront="PlayStation Store",
        )
    )
    db_session.commit()
    return ps5, games


def test_public_shelf_wrong_token_is_404(client, game_shelf_lab):
    assert client.get("/api/public/not-a-real-token/shelf").status_code == 404


def test_public_shelf_shares_only_the_public_shape(auth_client, client, db_session, game_shelf_lab):
    ps5, games = _seed(db_session)
    token = _token(auth_client)

    body = client.get(f"/api/public/{token}/shelf").json()

    assert body["cases"] == [
        {"gameId": games["Alpha"].id, "name": "Alpha", "platformId": ps5.id},
        {"gameId": games["Bravo"].id, "name": "Bravo", "platformId": ps5.id},
    ]
    assert [platform["name"] for platform in body["platforms"]] == ["PlayStation 5"]
    assert body["platforms"][0]["case"]["caseLabel"] == "Blu-ray case"
    # Nothing else about your copies leaks.
    text = str(body)
    for private in ("uuid", "slug': 'alpha", "steelbook", "PlayStation Store", "Digital", "shown", "physicalGames"):
        assert private not in text


def test_public_shelf_search_and_sort(auth_client, client, db_session, game_shelf_lab):
    _seed(db_session)
    token = _token(auth_client)

    def names(**params):
        return [case["name"] for case in client.get(f"/api/public/{token}/shelf", params=params).json()["cases"]]

    assert names(search="brav") == ["Bravo"]
    assert names(sort="release_date_asc") == ["Bravo", "Alpha"]
    # A sort the share page doesn't offer falls back to name.
    assert names(sort="rating_desc") == ["Alpha", "Bravo"]


def test_public_shelf_ignores_filters(auth_client, client, db_session, game_shelf_lab):
    _seed(db_session)
    token = _token(auth_client)
    body = client.get(f"/api/public/{token}/shelf", params={"steelbookOnly": "false", "platformId": 999}).json()
    assert len(body["cases"]) == 2
