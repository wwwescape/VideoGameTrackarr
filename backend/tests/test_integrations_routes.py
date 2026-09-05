import httpx
import respx

from app.core.config import get_settings
from app.models.catalog import Game, GameCategory
from app.models.library import GameProgress, LibraryItem, LibraryStatus
from app.models.steam import SteamLibraryEntry, SteamWishlistEntry


def test_get_integrations_requires_auth(client):
    response = client.get("/api/integrations")

    assert response.status_code == 401


def test_get_integrations_reflects_unconfigured_credentials(auth_client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "igdb_client_id", None)
    monkeypatch.setattr(settings, "igdb_client_secret", None)
    monkeypatch.setattr(settings, "steam_api_key", None)
    monkeypatch.setattr(settings, "itad_api_key", None)
    monkeypatch.setattr(settings, "platprices_api_key", None)

    response = auth_client.get("/api/integrations")

    assert response.status_code == 200
    body = response.json()
    assert body["igdbConfigured"] is False
    assert body["steamApiKeyConfigured"] is False
    assert body["steamId64"] is None
    assert body["itadConfigured"] is False
    assert body["platpricesConfigured"] is False


def test_get_integrations_reflects_configured_credentials(auth_client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "igdb_client_id", "test-client-id")
    monkeypatch.setattr(settings, "igdb_client_secret", "test-client-secret")
    monkeypatch.setattr(settings, "steam_api_key", "test-steam-key")
    monkeypatch.setattr(settings, "itad_api_key", "test-itad-key")
    monkeypatch.setattr(settings, "platprices_api_key", "test-platprices-key")

    response = auth_client.get("/api/integrations")

    assert response.status_code == 200
    body = response.json()
    assert body["itadConfigured"] is True
    assert body["igdbConfigured"] is True
    assert body["steamApiKeyConfigured"] is True
    assert body["platpricesConfigured"] is True


def test_update_steam_id_requires_auth(client):
    response = client.put("/api/integrations/steam", json={"steamId64": "76561197960287930"})

    assert response.status_code == 401


def test_update_steam_id_persists_the_value(auth_client):
    response = auth_client.put("/api/integrations/steam", json={"steamId64": "76561197960287930"})

    assert response.status_code == 200
    assert response.json()["steamId64"] == "76561197960287930"

    follow_up = auth_client.get("/api/integrations")
    assert follow_up.json()["steamId64"] == "76561197960287930"


def test_update_steam_id_can_clear_the_value(auth_client):
    auth_client.put("/api/integrations/steam", json={"steamId64": "76561197960287930"})

    response = auth_client.put("/api/integrations/steam", json={"steamId64": None})

    assert response.status_code == 200
    assert response.json()["steamId64"] is None


def _seed_matched_entry(db_session, steam_app_id=220, dismissed=False, steam_playtime_minutes=754):
    game = Game(igdb_id=233, name="Half-Life 2", slug="half-life-2", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    entry = SteamLibraryEntry(
        steam_app_id=steam_app_id,
        steam_name="Half-Life 2",
        steam_playtime_minutes=steam_playtime_minutes,
        game_id=game.id,
        dismissed=dismissed,
    )
    db_session.add(entry)
    db_session.commit()
    return game


def test_get_steam_entries_requires_auth(client):
    response = client.get("/api/integrations/steam/entries")

    assert response.status_code == 401


def test_get_steam_entries_reports_new_for_a_matched_untracked_game(auth_client, db_session):
    _seed_matched_entry(db_session)

    response = auth_client.get("/api/integrations/steam/entries")

    assert response.status_code == 200
    [entry] = response.json()
    assert entry["steamAppId"] == 220
    assert entry["gameName"] == "Half-Life 2"
    assert entry["status"] == "new"
    assert entry["vgtPlaytimeMinutes"] is None


def test_get_steam_entries_reports_up_to_date_when_playtime_matches(auth_client, db_session, seed_pc_platform):
    # Steam Sync's status comparison is PC-platform-scoped, so the seeded progress row
    # must be on the PC platform for it to be the one compared against Steam's number.
    game = _seed_matched_entry(db_session, steam_playtime_minutes=100)
    db_session.add(LibraryItem(game_id=game.id, platform_id=seed_pc_platform.id, status=LibraryStatus.OWNED))
    db_session.add(GameProgress(game_id=game.id, platform_id=seed_pc_platform.id, playtime_minutes=100))
    db_session.commit()

    [entry] = auth_client.get("/api/integrations/steam/entries").json()

    assert entry["status"] == "up_to_date"
    assert entry["vgtPlaytimeMinutes"] == 100


def test_get_steam_entries_reports_update_available_when_playtime_differs(auth_client, db_session, seed_pc_platform):
    game = _seed_matched_entry(db_session, steam_playtime_minutes=500)
    db_session.add(LibraryItem(game_id=game.id, platform_id=seed_pc_platform.id, status=LibraryStatus.OWNED))
    db_session.add(GameProgress(game_id=game.id, platform_id=seed_pc_platform.id, playtime_minutes=100))
    db_session.commit()

    [entry] = auth_client.get("/api/integrations/steam/entries").json()

    assert entry["status"] == "update_available"
    assert entry["vgtPlaytimeMinutes"] == 100


def test_get_steam_entries_reports_no_match_for_an_unmatched_entry(auth_client, db_session):
    db_session.add(SteamLibraryEntry(steam_app_id=999, steam_name="Some Unmatched Game", steam_playtime_minutes=0))
    db_session.commit()

    [entry] = auth_client.get("/api/integrations/steam/entries").json()

    assert entry["status"] == "no_match"
    assert entry["gameId"] is None


def test_get_steam_entries_reports_ignored_entries_but_still_lists_them(auth_client, db_session):
    _seed_matched_entry(db_session, dismissed=True)

    [entry] = auth_client.get("/api/integrations/steam/entries").json()

    assert entry["status"] == "ignored"


def test_sync_steam_entries_creates_library_item_and_progress_for_a_new_game(auth_client, db_session):
    game = _seed_matched_entry(db_session)

    response = auth_client.post("/api/integrations/steam/sync", json={"steamAppIds": [220]})

    assert response.status_code == 200
    assert response.json() == {"synced": 1, "failed": 0, "failures": []}
    library_items = db_session.query(LibraryItem).filter(LibraryItem.game_id == game.id).all()
    assert len(library_items) == 1
    assert library_items[0].status == LibraryStatus.OWNED
    assert library_items[0].digital_storefront == "Steam"
    progress = db_session.query(GameProgress).filter(GameProgress.game_id == game.id).first()
    assert progress.playtime_minutes == 754
    # The item now shows up as tracked, so its status flips away from "new".
    [entry] = auth_client.get("/api/integrations/steam/entries").json()
    assert entry["status"] == "up_to_date"


def test_sync_steam_entries_overwrites_playtime_even_downward(auth_client, db_session, seed_pc_platform):
    # Sync is now an explicit, confirmed action — it sets playtime straight to Steam's
    # number, it doesn't cap at the higher of the two like the old auto-sync policy did.
    game = _seed_matched_entry(db_session, steam_playtime_minutes=50)
    db_session.add(LibraryItem(game_id=game.id, platform_id=seed_pc_platform.id, status=LibraryStatus.OWNED))
    db_session.add(GameProgress(game_id=game.id, platform_id=seed_pc_platform.id, playtime_minutes=500))
    db_session.commit()

    auth_client.post("/api/integrations/steam/sync", json={"steamAppIds": [220]})

    progress = db_session.query(GameProgress).filter(GameProgress.game_id == game.id).first()
    assert progress.playtime_minutes == 50


def test_sync_steam_entries_preserves_progress_on_another_platform(auth_client, db_session, seed_platform):
    # The exact bug this rework fixes: a game owned on PS5 (seed_platform) as well as PC
    # must keep its PS5 progress untouched when Steam Sync applies PC playtime data.
    game = _seed_matched_entry(db_session, steam_playtime_minutes=754)
    db_session.add(LibraryItem(game_id=game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.add(GameProgress(game_id=game.id, platform_id=seed_platform.id, playtime_minutes=200, rating=9))
    db_session.commit()

    response = auth_client.post("/api/integrations/steam/sync", json={"steamAppIds": [220]})
    assert response.status_code == 200

    ps5_progress = (
        db_session.query(GameProgress)
        .filter(GameProgress.game_id == game.id, GameProgress.platform_id == seed_platform.id)
        .one()
    )
    assert ps5_progress.playtime_minutes == 200  # untouched
    assert ps5_progress.rating == 9

    pc_progress = (
        db_session.query(GameProgress)
        .filter(GameProgress.game_id == game.id, GameProgress.platform_id != seed_platform.id)
        .one()
    )
    assert pc_progress.playtime_minutes == 754


def test_sync_steam_entries_bulk_isolates_a_failure(auth_client, db_session):
    _seed_matched_entry(db_session, steam_app_id=220)

    response = auth_client.post("/api/integrations/steam/sync", json={"steamAppIds": [220, 999999]})

    assert response.status_code == 200
    body = response.json()
    assert body["synced"] == 1
    assert body["failed"] == 1
    assert body["failures"][0]["steamAppId"] == 999999


def test_ignore_steam_entry_marks_it_ignored(auth_client, db_session):
    _seed_matched_entry(db_session)

    response = auth_client.post("/api/integrations/steam/220/ignore")

    assert response.status_code == 200
    assert response.json()["status"] == "ignored"


@respx.mock
def test_get_steam_store_details_returns_mapped_fields(auth_client):
    respx.get("https://store.steampowered.com/api/appdetails").mock(
        return_value=httpx.Response(
            200,
            json={
                "220": {
                    "success": True,
                    "data": {
                        "name": "Half-Life 2",
                        "short_description": "Reawakened from stasis...",
                        "header_image": "https://example.com/header.jpg",
                    },
                }
            },
        )
    )
    respx.head("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/220/library_600x900.jpg").mock(
        return_value=httpx.Response(404)
    )

    response = auth_client.get("/api/integrations/steam/220/store-details")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Half-Life 2"
    assert body["coverUrl"] == "https://example.com/header.jpg"


@respx.mock
def test_get_steam_store_details_404s_when_steam_has_no_such_app(auth_client):
    respx.get("https://store.steampowered.com/api/appdetails").mock(
        return_value=httpx.Response(200, json={"999999999": {"success": False}})
    )

    response = auth_client.get("/api/integrations/steam/999999999/store-details")

    assert response.status_code == 404


def _seed_matched_parent_with_dlc(db_session, parent_steam_app_id=220, dlc_steam_app_id=221, dlc_dismissed=False):
    parent = Game(igdb_id=233, name="Half-Life 2", slug="half-life-2", category=GameCategory.MAIN_GAME)
    db_session.add(parent)
    db_session.commit()
    dlc = Game(
        igdb_id=234,
        name="Half-Life 2: Episode One",
        slug="half-life-2-episode-one",
        category=GameCategory.DLC_ADDON,
        parent_game_id=parent.id,
    )
    db_session.add(dlc)
    db_session.commit()
    db_session.add(
        SteamLibraryEntry(
            steam_app_id=parent_steam_app_id, steam_name="Half-Life 2", steam_playtime_minutes=754, game_id=parent.id
        )
    )
    db_session.add(
        SteamLibraryEntry(
            steam_app_id=dlc_steam_app_id,
            steam_name="Half-Life 2: Episode One",
            steam_playtime_minutes=300,
            game_id=dlc.id,
            dismissed=dlc_dismissed,
        )
    )
    db_session.commit()
    return parent, dlc


def test_get_steam_entries_includes_a_dlc_matched_entry_with_its_parent_id(auth_client, db_session):
    parent, dlc = _seed_matched_parent_with_dlc(db_session)

    entries = auth_client.get("/api/integrations/steam/entries").json()

    by_app_id = {entry["steamAppId"]: entry for entry in entries}
    assert set(by_app_id) == {220, 221}
    assert by_app_id[220]["parentGameId"] is None
    assert by_app_id[221]["parentGameId"] == parent.id


def test_sync_steam_entries_cascades_to_an_owned_dlc(auth_client, db_session):
    parent, dlc = _seed_matched_parent_with_dlc(db_session)

    response = auth_client.post("/api/integrations/steam/sync", json={"steamAppIds": [220]})

    assert response.status_code == 200
    assert response.json() == {"synced": 1, "failed": 0, "failures": []}
    parent_items = db_session.query(LibraryItem).filter(LibraryItem.game_id == parent.id).all()
    dlc_items = db_session.query(LibraryItem).filter(LibraryItem.game_id == dlc.id).all()
    assert len(parent_items) == 1
    assert len(dlc_items) == 1
    assert dlc_items[0].status == LibraryStatus.OWNED
    assert dlc_items[0].digital_storefront == "Steam"
    dlc_progress = db_session.query(GameProgress).filter(GameProgress.game_id == dlc.id).first()
    assert dlc_progress.playtime_minutes == 300


def test_sync_steam_entries_does_not_cascade_to_a_dismissed_dlc(auth_client, db_session):
    parent, dlc = _seed_matched_parent_with_dlc(db_session, dlc_dismissed=True)

    auth_client.post("/api/integrations/steam/sync", json={"steamAppIds": [220]})

    assert db_session.query(LibraryItem).filter(LibraryItem.game_id == dlc.id).count() == 0


def _seed_matched_wishlist_entry(db_session, steam_app_id=220, dismissed=False):
    game = Game(igdb_id=233, name="Half-Life 2", slug="half-life-2", category=GameCategory.MAIN_GAME)
    db_session.add(game)
    db_session.commit()
    entry = SteamWishlistEntry(
        steam_app_id=steam_app_id, steam_name="Half-Life 2", game_id=game.id, dismissed=dismissed
    )
    db_session.add(entry)
    db_session.commit()
    return game


def test_get_steam_wishlist_entries_requires_auth(client):
    response = client.get("/api/integrations/steam/wishlist/entries")

    assert response.status_code == 401


def test_get_steam_wishlist_entries_reports_new_for_a_matched_untracked_game(auth_client, db_session):
    _seed_matched_wishlist_entry(db_session)

    response = auth_client.get("/api/integrations/steam/wishlist/entries")

    assert response.status_code == 200
    [entry] = response.json()
    assert entry["steamAppId"] == 220
    assert entry["gameName"] == "Half-Life 2"
    assert entry["status"] == "new"


def test_get_steam_wishlist_entries_reports_already_wishlisted(auth_client, db_session, seed_pc_platform):
    game = _seed_matched_wishlist_entry(db_session)
    db_session.add(LibraryItem(game_id=game.id, platform_id=seed_pc_platform.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    [entry] = auth_client.get("/api/integrations/steam/wishlist/entries").json()

    assert entry["status"] == "already_wishlisted"


def test_get_steam_wishlist_entries_reports_no_match_for_an_unmatched_entry(auth_client, db_session):
    db_session.add(SteamWishlistEntry(steam_app_id=999, steam_name="Steam App 999"))
    db_session.commit()

    [entry] = auth_client.get("/api/integrations/steam/wishlist/entries").json()

    assert entry["status"] == "no_match"
    assert entry["gameId"] is None


def test_get_steam_wishlist_entries_reports_ignored_entries_but_still_lists_them(auth_client, db_session):
    _seed_matched_wishlist_entry(db_session, dismissed=True)

    [entry] = auth_client.get("/api/integrations/steam/wishlist/entries").json()

    assert entry["status"] == "ignored"


def test_get_steam_wishlist_entries_includes_a_dlc_matched_entry_with_its_parent_id(auth_client, db_session):
    parent = Game(igdb_id=233, name="Half-Life 2", slug="half-life-2", category=GameCategory.MAIN_GAME)
    db_session.add(parent)
    db_session.commit()
    dlc = Game(
        igdb_id=234,
        name="Half-Life 2: Episode One",
        slug="half-life-2-episode-one",
        category=GameCategory.DLC_ADDON,
        parent_game_id=parent.id,
    )
    db_session.add(dlc)
    db_session.commit()
    db_session.add(SteamWishlistEntry(steam_app_id=220, steam_name="Half-Life 2", game_id=parent.id))
    db_session.add(SteamWishlistEntry(steam_app_id=221, steam_name="Half-Life 2: Episode One", game_id=dlc.id))
    db_session.commit()

    entries = auth_client.get("/api/integrations/steam/wishlist/entries").json()

    by_app_id = {entry["steamAppId"]: entry for entry in entries}
    assert set(by_app_id) == {220, 221}
    assert by_app_id[220]["parentGameId"] is None
    assert by_app_id[221]["parentGameId"] == parent.id


def test_sync_steam_wishlist_entries_creates_a_wishlist_library_item(auth_client, db_session):
    game = _seed_matched_wishlist_entry(db_session)

    response = auth_client.post("/api/integrations/steam/wishlist/sync", json={"steamAppIds": [220]})

    assert response.status_code == 200
    assert response.json() == {"synced": 1, "failed": 0, "failures": []}
    [library_item] = db_session.query(LibraryItem).filter(LibraryItem.game_id == game.id).all()
    assert library_item.status == LibraryStatus.WISHLIST
    assert library_item.digital_storefront == "Steam"
    assert library_item.format.value == "digital"
    [entry] = auth_client.get("/api/integrations/steam/wishlist/entries").json()
    assert entry["status"] == "already_wishlisted"


def test_sync_steam_wishlist_entries_cascades_to_a_wishlisted_dlc(auth_client, db_session):
    parent = Game(igdb_id=233, name="Half-Life 2", slug="half-life-2", category=GameCategory.MAIN_GAME)
    db_session.add(parent)
    db_session.commit()
    dlc = Game(
        igdb_id=234,
        name="Half-Life 2: Episode One",
        slug="half-life-2-episode-one",
        category=GameCategory.DLC_ADDON,
        parent_game_id=parent.id,
    )
    db_session.add(dlc)
    db_session.commit()
    db_session.add(SteamWishlistEntry(steam_app_id=220, steam_name="Half-Life 2", game_id=parent.id))
    db_session.add(SteamWishlistEntry(steam_app_id=221, steam_name="Half-Life 2: Episode One", game_id=dlc.id))
    db_session.commit()

    auth_client.post("/api/integrations/steam/wishlist/sync", json={"steamAppIds": [220]})

    assert db_session.query(LibraryItem).filter(LibraryItem.game_id == dlc.id).count() == 1


def test_ignore_steam_wishlist_entry_marks_it_ignored(auth_client, db_session):
    _seed_matched_wishlist_entry(db_session)

    response = auth_client.post("/api/integrations/steam/wishlist/220/ignore")

    assert response.status_code == 200
    assert response.json()["status"] == "ignored"
