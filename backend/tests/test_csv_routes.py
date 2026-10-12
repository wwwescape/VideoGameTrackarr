from datetime import date

from sqlalchemy import select

from app.models.catalog import Game, GameCategory, Platform, Region
from app.models.library import LibraryItem, LibraryStatus, MediaFormat


def test_export_csv_requires_auth(client):
    response = client.get("/api/export/csv")

    assert response.status_code == 401


def test_export_csv_includes_existing_library_items(auth_client, db_session):
    game = Game(name="Zelda", category=GameCategory.MAIN_GAME)
    platform = Platform(name="NES")
    region = Region(name="NTSC-U")
    db_session.add_all([game, platform, region])
    db_session.flush()
    db_session.add(
        LibraryItem(
            game_id=game.id,
            status=LibraryStatus.OWNED,
            platform_id=platform.id,
            region_id=region.id,
            format=MediaFormat.PHYSICAL,
            edition="GOTY",
            acquired_at=date(2021, 1, 1),
            notes="Great",
        )
    )
    db_session.commit()

    response = auth_client.get("/api/export/csv")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    lines = response.text.strip().splitlines()
    assert lines[0] == "name,category,status,platform,region,format,edition,acquired_at,notes"
    assert "Zelda,main_game,owned,NES,NTSC-U,physical,GOTY,2021-01-01,Great" in lines[1]


def _csv_file(rows: str):
    return {"file": ("library.csv", rows.encode("utf-8"), "text/csv")}


def test_import_csv_requires_auth(client):
    response = client.post("/api/import/csv", files=_csv_file("name\nZelda\n"))

    assert response.status_code == 401


def test_import_csv_creates_games_and_items(auth_client, db_session):
    csv_text = (
        "name,category,status,platform,region,format,edition,acquired_at,notes\n"
        "Zelda,main_game,owned,NES,NTSC-U,physical,GOTY,2021-01-01,Great\n"
        "Metroid,,wishlist,SNES,,digital,,,\n"
    )

    response = auth_client.post("/api/import/csv", files=_csv_file(csv_text))

    assert response.status_code == 200
    body = response.json()
    assert body["imported"] == 2
    assert body["skipped"] == 0
    assert body["errors"] == []

    zelda = db_session.scalar(select(Game).where(Game.name == "Zelda"))
    assert zelda is not None
    assert zelda.category == GameCategory.MAIN_GAME
    items = db_session.scalars(
        select(LibraryItem).where(LibraryItem.game_id == zelda.id)
    ).all()
    assert len(items) == 1
    assert items[0].status == LibraryStatus.OWNED
    assert items[0].platform.name == "NES"
    assert items[0].region.name == "NTSC-U"
    assert items[0].format == MediaFormat.PHYSICAL
    assert items[0].edition == "GOTY"
    assert items[0].acquired_at == date(2021, 1, 1)
    assert items[0].notes == "Great"

    metroid = db_session.scalar(select(Game).where(Game.name == "Metroid"))
    metroid_items = db_session.scalars(
        select(LibraryItem).where(LibraryItem.game_id == metroid.id)
    ).all()
    assert metroid_items[0].status == LibraryStatus.WISHLIST
    assert metroid_items[0].format == MediaFormat.DIGITAL


def test_import_csv_skips_bad_rows_but_imports_good_ones(auth_client):
    csv_text = (
        "Zelda,main_game,owned,NES,,,physical,,\n"
        ",main_game,owned,NES,,,physical,,\n"
        "Metroid,bogus_category,owned,SNES,,,physical,,\n"
    )

    response = auth_client.post("/api/import/csv", files=_csv_file(csv_text))

    assert response.status_code == 200
    body = response.json()
    assert body["imported"] == 1
    assert body["skipped"] == 2
    assert len(body["errors"]) == 2
    assert body["errors"][0]["row"] == 2
    assert "name is required" in body["errors"][0]["message"]
    assert body["errors"][1]["row"] == 3
    assert "invalid category" in body["errors"][1]["message"]


def test_import_csv_is_idempotent(auth_client):
    csv_text = (
        "name,category,status,platform,region,format,edition,acquired_at,notes\n"
        "Zelda,main_game,owned,NES,,,physical,,\n"
    )

    first = auth_client.post("/api/import/csv", files=_csv_file(csv_text)).json()
    second = auth_client.post("/api/import/csv", files=_csv_file(csv_text)).json()

    assert first["imported"] == 1
    assert second["imported"] == 0
    assert second["skipped"] == 1
