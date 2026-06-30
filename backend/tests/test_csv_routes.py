from datetime import date

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
