from datetime import UTC, date, datetime, timedelta

from app.models.catalog import Game, GameCategory
from app.models.hardware import HardwareReferenceEntry, UserAccessory, UserDevice
from app.models.library import GameProgress, LibraryItem, LibraryStatus, PlayStatus


def _link_device_to_reference(db_session, device, release_date: date) -> None:
    """Devices have no release_date column of their own — a device's release date for the
    release calendar always comes from its linked HardwareReferenceEntry."""
    entry = HardwareReferenceEntry(
        brand="Sony",
        generation="PlayStation 5",
        artefact="PlayStation 5",
        official_name=f"Sony PlayStation 5 (test ref {release_date.isoformat()})",
        category="Console",
        type="Device",
        release_date=release_date.isoformat(),
        discontinued=False,
    )
    db_session.add(entry)
    db_session.flush()
    device.hardware_reference_entry_id = entry.id
    db_session.commit()


def _future_timestamp(days: int) -> int:
    return int((datetime.now(UTC) + timedelta(days=days)).timestamp())


def _past_timestamp(days: int) -> int:
    return int((datetime.now(UTC) - timedelta(days=days)).timestamp())


def test_stats_requires_auth(client):
    response = client.get("/api/dashboard/stats")

    assert response.status_code == 401


def test_stats_on_empty_library(auth_client):
    response = auth_client.get("/api/dashboard/stats")

    assert response.status_code == 200
    body = response.json()
    assert body["totalOwned"] == 0
    assert body["totalWishlisted"] == 0
    assert body["totalPlaytimeMinutes"] == 0
    assert body["averageRating"] is None
    assert body["recentlyAdded"] == []
    assert body["recentlyPlayed"] == []


def test_stats_counts_and_breakdowns(auth_client, db_session, seed_game, seed_platform):
    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    other_game = Game(igdb_id=5005, name="Wishlisted Game", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    db_session.commit()
    db_session.add(LibraryItem(game_id=other_game.id, status=LibraryStatus.WISHLIST))
    db_session.add(
        GameProgress(game_id=seed_game.id, play_status=PlayStatus.PLAYING, playtime_minutes=120, rating=8)
    )
    db_session.commit()

    response = auth_client.get("/api/dashboard/stats")

    body = response.json()
    assert body["totalOwned"] == 1
    assert body["totalWishlisted"] == 1
    assert body["totalTracked"] == 2
    assert body["totalPlaytimeMinutes"] == 120
    assert body["averageRating"] == 8
    assert body["playStatusBreakdown"] == {"playing": 1}
    assert {p["name"]: p["count"] for p in body["platformBreakdown"]} == {seed_platform.name: 1}


def test_stats_recently_added_and_recently_played(auth_client, db_session, seed_game):
    db_session.add(GameProgress(game_id=seed_game.id, last_played_at=datetime.now(UTC).date()))
    db_session.commit()

    response = auth_client.get("/api/dashboard/stats")

    body = response.json()
    assert [g["id"] for g in body["recentlyAdded"]] == [seed_game.id]
    assert [g["id"] for g in body["recentlyPlayed"]] == [seed_game.id]


def test_release_calendar_requires_auth(client):
    response = client.get("/api/dashboard/release-calendar")

    assert response.status_code == 401


def test_release_calendar_includes_future_wishlisted_game(auth_client, db_session, seed_game):
    seed_game.first_release_date = _future_timestamp(30)
    db_session.add(LibraryItem(game_id=seed_game.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    response = auth_client.get("/api/dashboard/release-calendar")

    assert response.status_code == 200
    [item] = response.json()
    assert item["kind"] == "game"
    assert item["game"]["id"] == seed_game.id


def test_release_calendar_excludes_past_releases(auth_client, db_session, seed_game):
    seed_game.first_release_date = _past_timestamp(30)
    db_session.add(LibraryItem(game_id=seed_game.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    response = auth_client.get("/api/dashboard/release-calendar")

    assert response.json() == []


def test_release_calendar_excludes_games_not_in_library(auth_client, db_session, seed_game):
    seed_game.first_release_date = _future_timestamp(30)
    db_session.commit()

    response = auth_client.get("/api/dashboard/release-calendar")

    assert response.json() == []


def test_release_calendar_orders_soonest_first(auth_client, db_session, seed_game):
    later_game = Game(
        igdb_id=5006, name="Later Game", category=GameCategory.MAIN_GAME, first_release_date=_future_timestamp(90)
    )
    db_session.add(later_game)
    seed_game.first_release_date = _future_timestamp(10)
    db_session.commit()
    db_session.add(LibraryItem(game_id=seed_game.id, status=LibraryStatus.WISHLIST))
    db_session.add(LibraryItem(game_id=later_game.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    response = auth_client.get("/api/dashboard/release-calendar")

    assert [item["game"]["id"] for item in response.json()] == [seed_game.id, later_game.id]


def test_release_calendar_includes_future_wishlisted_device(auth_client, db_session, seed_device):
    _link_device_to_reference(db_session, seed_device, date.today() + timedelta(days=30))
    db_session.add(UserDevice(device_id=seed_device.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    response = auth_client.get("/api/dashboard/release-calendar")

    [item] = response.json()
    assert item["kind"] == "device"
    assert item["device"]["id"] == seed_device.id


def test_release_calendar_includes_future_wishlisted_accessory(auth_client, db_session, seed_accessory):
    # Year-only precision means "future" can only be checked at year granularity — a
    # same-year release can't be reliably distinguished as upcoming vs. already past.
    seed_accessory.release_date = date.today().year + 1
    db_session.add(UserAccessory(accessory_id=seed_accessory.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    response = auth_client.get("/api/dashboard/release-calendar")

    [item] = response.json()
    assert item["kind"] == "accessory"
    assert item["accessory"]["id"] == seed_accessory.id


def test_release_calendar_excludes_hardware_not_owned_or_wishlisted(auth_client, db_session, seed_device):
    _link_device_to_reference(db_session, seed_device, date.today() + timedelta(days=30))

    response = auth_client.get("/api/dashboard/release-calendar")

    assert response.json() == []


def test_release_calendar_excludes_past_hardware_releases(auth_client, db_session, seed_device):
    _link_device_to_reference(db_session, seed_device, date.today() - timedelta(days=30))
    db_session.add(UserDevice(device_id=seed_device.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    response = auth_client.get("/api/dashboard/release-calendar")

    assert response.json() == []


def test_release_calendar_sorts_games_and_hardware_together_by_date(auth_client, db_session, seed_game, seed_device):
    seed_game.first_release_date = _future_timestamp(30)
    _link_device_to_reference(db_session, seed_device, date.today() + timedelta(days=10))
    db_session.add(LibraryItem(game_id=seed_game.id, status=LibraryStatus.WISHLIST))
    db_session.add(UserDevice(device_id=seed_device.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    response = auth_client.get("/api/dashboard/release-calendar")

    kinds = [item["kind"] for item in response.json()]
    assert kinds == ["device", "game"]
