import time
from datetime import UTC, datetime

from app.models.catalog import Collection, Franchise, Game, GameCategory, GameCollection, GameFranchise, Platform
from app.models.itad import ItadPriceCache
from app.models.library import (
    GameProgress,
    GameTag,
    LibraryItem,
    LibraryStatus,
    MediaFormat,
    Note,
    PlaySession,
    PlayStatus,
    RomFile,
    Tag,
)
from app.services import game_service


def _fake_game_with_status(game):
    from app.repositories.game_repository import GameWithStatus

    return GameWithStatus(game=game, owned=False, wishlisted=False, play_status=None, rating=None)


def _wait_for_bulk_import_completion(client, timeout: float = 5.0) -> dict:
    # Bulk import runs on a background thread (see app/services/bulk_import_job.py) so the
    # POST returns as soon as the job starts, not once it finishes — same polling pattern
    # test_backup_routes.py's _wait_for_restore_completion already uses for restore.
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        body = client.get("/api/games/bulk-import/status").json()
        if body["status"] != "running":
            return body
        time.sleep(0.02)
    raise AssertionError("Bulk import did not finish within the test timeout")


def test_list_games_requires_auth(client):
    response = client.get("/api/games")

    assert response.status_code == 401


def test_list_games_returns_top_level_games_only(auth_client, db_session, seed_game):
    addon = Game(igdb_id=2002, name="Test Game DLC", category=GameCategory.DLC_ADDON, parent_game_id=seed_game.id)
    db_session.add(addon)
    db_session.commit()

    response = auth_client.get("/api/games")

    assert response.status_code == 200
    names = [g["name"] for g in response.json()]
    assert names == ["Test Game"]


def test_list_games_exposes_auto_discovered_on_the_summary(auth_client, db_session, seed_game):
    """Regression test: autoDiscovered must be on GameSummaryResponse, not just the detail
    response — GameCard needs it wherever a cover renders (Games list, Collection/Series
    browse), to tell a still-unclaimed "what's missing" discovery (greyscale + chip) apart
    from a manually-added game that just isn't owned/wishlisted yet (greyscale, no chip)."""
    discovered = Game(
        igdb_id=2003, name="Discovered Game", category=GameCategory.MAIN_GAME, auto_discovered=True
    )
    db_session.add(discovered)
    db_session.commit()

    response = auth_client.get("/api/games")

    by_name = {g["name"]: g["autoDiscovered"] for g in response.json()}
    assert by_name == {"Test Game": False, "Discovered Game": True}


def test_list_and_detail_expose_is_on_sale_for_a_wishlisted_itad_eligible_game(
    auth_client, db_session, seed_game, seed_pc_platform
):
    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            platform_id=seed_pc_platform.id,
            status=LibraryStatus.WISHLIST,
            format=MediaFormat.DIGITAL,
            track_for_sales=True,
        )
    )
    db_session.add(
        ItadPriceCache(game_id=seed_game.id, itad_game_id="itad-1", current_price_amount=9.99, current_cut=50)
    )
    db_session.commit()

    list_response = auth_client.get("/api/games")
    detail_response = auth_client.get(f"/api/games/{seed_game.slug}")

    assert list_response.json()[0]["isOnSale"] is True
    assert detail_response.json()["isOnSale"] is True


def test_list_games_is_not_on_sale_without_a_wishlisted_eligible_item(auth_client, db_session, seed_game):
    # A cached ITAD price with no eligible wishlist row backing it (nothing owned/wishlisted
    # on an ITAD-eligible platform) must not flag the game as on sale.
    db_session.add(
        ItadPriceCache(game_id=seed_game.id, itad_game_id="itad-1", current_price_amount=9.99, current_cut=50)
    )
    db_session.commit()

    response = auth_client.get("/api/games")

    assert response.json()[0]["isOnSale"] is False


def test_list_games_excludes_non_browsable_categories_even_without_a_parent(auth_client, db_session, seed_game):
    # These have no structural parent (e.g. resolved to display_parent_game_id instead, or
    # never had one to begin with) but still aren't something a user browses as "their own
    # game" — a community mod, a seasonal content drop, an update, etc.
    excluded = [
        Game(igdb_id=2100, name="Some Mod", category=GameCategory.MOD),
        Game(igdb_id=2102, name="Some Update", category=GameCategory.UPDATE),
        Game(igdb_id=2103, name="Some Season", category=GameCategory.SEASON),
    ]
    included = [
        Game(igdb_id=2104, name="Some Remaster", category=GameCategory.REMASTER),
        Game(igdb_id=2105, name="Some Standalone Expansion", category=GameCategory.STANDALONE_EXPANSION),
        Game(igdb_id=2106, name="Some Expanded Game", category=GameCategory.EXPANDED_GAME),
        Game(igdb_id=2108, name="Some Bundle", category=GameCategory.BUNDLE),
        Game(igdb_id=2109, name="Some Remake", category=GameCategory.REMAKE),
        Game(igdb_id=2110, name="Some Port", category=GameCategory.PORT),
        Game(igdb_id=2107, name="Uncategorized Game", category=None),
    ]
    db_session.add_all(excluded + included)
    db_session.commit()

    response = auth_client.get("/api/games")

    assert response.status_code == 200
    names = {g["name"] for g in response.json()}
    assert names == {"Test Game", *(g.name for g in included)}


def test_list_games_search_is_case_insensitive_substring(auth_client, db_session, seed_game):
    response = auth_client.get("/api/games", params={"search": "test g"})
    assert [g["id"] for g in response.json()] == [seed_game.id]

    response = auth_client.get("/api/games", params={"search": "TEST G"})
    assert [g["id"] for g in response.json()] == [seed_game.id]

    response = auth_client.get("/api/games", params={"search": "no match"})
    assert response.json() == []


def test_list_games_filters_by_platform_tag_collection_and_franchise(auth_client, db_session, seed_game, seed_platform):
    other_game = Game(igdb_id=2200, name="Other Game", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    db_session.commit()

    other_platform = Platform(name="Nintendo Game Boy", slug="game-boy")
    tag = Tag(name="Roguelike")
    collection = Collection(name="Age of Empires Series", slug="age-of-empires")
    franchise = Franchise(name="Final Fantasy", slug="final-fantasy")
    db_session.add_all([other_platform, tag, collection, franchise])
    db_session.commit()

    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.add(GameTag(game_id=seed_game.id, tag_id=tag.id))
    db_session.add(GameCollection(game_id=seed_game.id, collection_id=collection.id))
    db_session.add(GameFranchise(game_id=seed_game.id, franchise_id=franchise.id))
    db_session.commit()

    response = auth_client.get("/api/games", params={"platformId": seed_platform.id})
    assert [g["id"] for g in response.json()] == [seed_game.id]

    response = auth_client.get("/api/games", params={"platformId": other_platform.id})
    assert response.json() == []

    response = auth_client.get("/api/games", params={"tagId": tag.id})
    assert [g["id"] for g in response.json()] == [seed_game.id]

    response = auth_client.get("/api/games", params={"collectionId": collection.id})
    assert [g["id"] for g in response.json()] == [seed_game.id]

    response = auth_client.get("/api/games", params={"franchiseId": franchise.id})
    assert [g["id"] for g in response.json()] == [seed_game.id]

    # search and a filter combine with AND, not OR.
    response = auth_client.get("/api/games", params={"search": "other", "tagId": tag.id})
    assert response.json() == []


def test_list_games_filters_by_tag_id_matches_any_selected_tag(auth_client, db_session, seed_game):
    other_game = Game(igdb_id=2201, name="Other Game", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    db_session.commit()

    tag_a = Tag(name="Roguelike")
    tag_b = Tag(name="Metroidvania")
    db_session.add_all([tag_a, tag_b])
    db_session.commit()

    db_session.add(GameTag(game_id=seed_game.id, tag_id=tag_a.id))
    db_session.add(GameTag(game_id=other_game.id, tag_id=tag_b.id))
    db_session.commit()

    response = auth_client.get("/api/games", params=[("tagId", tag_a.id), ("tagId", tag_b.id)])
    names = {g["name"] for g in response.json()}
    assert names == {"Test Game", "Other Game"}


def test_list_games_filters_by_collection_id_matches_any_selected_collection(auth_client, db_session, seed_game):
    other_game = Game(igdb_id=2205, name="Other Game", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    db_session.commit()

    collection_a = Collection(name="Age of Empires Series", slug="age-of-empires")
    collection_b = Collection(name="Halo Series", slug="halo")
    db_session.add_all([collection_a, collection_b])
    db_session.commit()

    db_session.add(GameCollection(game_id=seed_game.id, collection_id=collection_a.id))
    db_session.add(GameCollection(game_id=other_game.id, collection_id=collection_b.id))
    db_session.commit()

    response = auth_client.get(
        "/api/games", params=[("collectionId", collection_a.id), ("collectionId", collection_b.id)]
    )
    names = {g["name"] for g in response.json()}
    assert names == {"Test Game", "Other Game"}


def test_list_games_filters_by_franchise_id_matches_any_selected_franchise(auth_client, db_session, seed_game):
    other_game = Game(igdb_id=2206, name="Other Game", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    db_session.commit()

    franchise_a = Franchise(name="Final Fantasy", slug="final-fantasy")
    franchise_b = Franchise(name="Dragon Quest", slug="dragon-quest")
    db_session.add_all([franchise_a, franchise_b])
    db_session.commit()

    db_session.add(GameFranchise(game_id=seed_game.id, franchise_id=franchise_a.id))
    db_session.add(GameFranchise(game_id=other_game.id, franchise_id=franchise_b.id))
    db_session.commit()

    response = auth_client.get(
        "/api/games", params=[("franchiseId", franchise_a.id), ("franchiseId", franchise_b.id)]
    )
    names = {g["name"] for g in response.json()}
    assert names == {"Test Game", "Other Game"}


def test_list_games_filters_by_category_matches_any_selected_category(auth_client, db_session, seed_game):
    # seed_game is category MAIN_GAME (see conftest.seed_game). remaster_game is a different
    # *browsable* category left out of the filter's selection — proves the category filter
    # itself is narrowing the result, not just piggybacking on the base browsable-only filter
    # that would already exclude a non-browsable category like MOD regardless.
    bundle_game = Game(igdb_id=2203, name="Bundle Game", category=GameCategory.BUNDLE)
    remaster_game = Game(igdb_id=2204, name="Remaster Game", category=GameCategory.REMASTER)
    db_session.add_all([bundle_game, remaster_game])
    db_session.commit()

    response = auth_client.get(
        "/api/games", params=[("category", "main_game"), ("category", "bundle")]
    )

    names = {g["name"] for g in response.json()}
    assert names == {"Test Game", "Bundle Game"}


def test_list_games_filters_by_platform_id_matches_any_selected_platform(
    auth_client, db_session, seed_game, seed_platform
):
    other_game = Game(igdb_id=2202, name="Other Game", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    db_session.commit()

    other_platform = Platform(name="Nintendo Game Boy", slug="game-boy")
    db_session.add(other_platform)
    db_session.commit()

    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.add(LibraryItem(game_id=other_game.id, platform_id=other_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get(
        "/api/games", params=[("platformId", seed_platform.id), ("platformId", other_platform.id)]
    )
    names = {g["name"] for g in response.json()}
    assert names == {"Test Game", "Other Game"}


def test_list_games_filters_by_format(auth_client, db_session, seed_game, seed_platform):
    physical_game = Game(igdb_id=2210, name="Physical Game", category=GameCategory.MAIN_GAME)
    db_session.add(physical_game)
    db_session.commit()

    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            platform_id=seed_platform.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.DIGITAL,
        )
    )
    db_session.add(
        LibraryItem(
            game_id=physical_game.id,
            platform_id=seed_platform.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.PHYSICAL,
        )
    )
    db_session.commit()

    response = auth_client.get("/api/games", params={"format": "digital"})
    assert [g["name"] for g in response.json()] == ["Test Game"]

    response = auth_client.get("/api/games", params={"format": "physical"})
    assert [g["name"] for g in response.json()] == ["Physical Game"]


def test_list_games_filters_by_storefront(auth_client, db_session, seed_game, seed_platform):
    other_game = Game(igdb_id=2211, name="Other Game", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    db_session.commit()

    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            platform_id=seed_platform.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.DIGITAL,
            digital_storefront="Steam",
        )
    )
    db_session.add(
        LibraryItem(
            game_id=other_game.id,
            platform_id=seed_platform.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.DIGITAL,
            digital_storefront="GOG",
        )
    )
    db_session.commit()

    response = auth_client.get("/api/games", params={"storefront": "Steam"})
    assert [g["name"] for g in response.json()] == ["Test Game"]


def test_list_games_filters_by_steelbook_only(auth_client, db_session, seed_game, seed_platform):
    other_game = Game(igdb_id=2213, name="Other Game", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    db_session.commit()

    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            platform_id=seed_platform.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.PHYSICAL,
            steelbook=True,
        )
    )
    db_session.add(
        LibraryItem(
            game_id=other_game.id,
            platform_id=seed_platform.id,
            status=LibraryStatus.OWNED,
            format=MediaFormat.PHYSICAL,
            steelbook=False,
        )
    )
    db_session.commit()

    response = auth_client.get("/api/games", params={"steelbookOnly": True})
    assert [g["name"] for g in response.json()] == ["Test Game"]

    response = auth_client.get("/api/games")
    assert {g["name"] for g in response.json()} == {"Test Game", "Other Game"}


def test_list_storefronts_returns_distinct_values_only(auth_client, db_session, seed_game, seed_platform):
    other_game = Game(igdb_id=2212, name="Other Game", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    db_session.commit()

    db_session.add(
        LibraryItem(
            game_id=seed_game.id,
            platform_id=seed_platform.id,
            status=LibraryStatus.OWNED,
            digital_storefront="Steam",
        )
    )
    db_session.add(
        LibraryItem(
            game_id=other_game.id,
            platform_id=seed_platform.id,
            status=LibraryStatus.OWNED,
            digital_storefront="Steam",
        )
    )
    db_session.add(
        LibraryItem(game_id=other_game.id, platform_id=seed_platform.id, status=LibraryStatus.WISHLIST)
    )
    db_session.commit()

    response = auth_client.get("/api/storefronts")

    assert response.status_code == 200
    assert response.json() == ["Steam"]


def test_list_games_platform_exclude_shows_everything_except_selected(
    auth_client, db_session, seed_game, seed_platform
):
    other_game = Game(igdb_id=2213, name="Other Game", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    db_session.commit()

    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get(
        "/api/games", params={"platformId": seed_platform.id, "platformExclude": "true"}
    )

    # Test Game is on seed_platform (excluded); Other Game has no library item at all, so it
    # has no copy on seed_platform either and correctly stays in the "everything else" result.
    assert [g["name"] for g in response.json()] == ["Other Game"]


def test_list_games_category_exclude_shows_everything_except_selected(auth_client, db_session, seed_game):
    # seed_game is MAIN_GAME (see conftest.seed_game).
    bundle_game = Game(igdb_id=2214, name="Bundle Game", category=GameCategory.BUNDLE)
    db_session.add(bundle_game)
    db_session.commit()

    response = auth_client.get(
        "/api/games", params={"category": "main_game", "categoryExclude": "true"}
    )

    assert [g["name"] for g in response.json()] == ["Bundle Game"]


def test_list_games_source_filter_splits_igdb_and_custom_games(auth_client, db_session, seed_game):
    # seed_game is IGDB-backed; a manually-added game has no igdb_id.
    db_session.add(Game(igdb_id=None, name="Custom Game", category=GameCategory.MAIN_GAME))
    db_session.commit()

    custom = auth_client.get("/api/games", params={"source": "custom"})
    igdb = auth_client.get("/api/games", params={"source": "igdb"})
    not_custom = auth_client.get("/api/games", params={"source": "custom", "sourceExclude": "true"})
    both = auth_client.get("/api/games", params={"source": ["igdb", "custom"]})

    assert [g["name"] for g in custom.json()] == ["Custom Game"]
    assert [g["name"] for g in igdb.json()] == [seed_game.name]
    assert [g["name"] for g in not_custom.json()] == [seed_game.name]
    assert sorted(g["name"] for g in both.json()) == sorted(["Custom Game", seed_game.name])



def _seed_tagged_games(db_session, seed_game):
    """Test Game: Roguelike + Metroidvania; Roguelike Only: Roguelike; Untagged: none."""
    roguelike_only = Game(igdb_id=2400, name="Roguelike Only", category=GameCategory.MAIN_GAME)
    untagged = Game(igdb_id=2401, name="Untagged", category=GameCategory.MAIN_GAME)
    tag_a = Tag(name="Roguelike")
    tag_b = Tag(name="Metroidvania")
    db_session.add_all([roguelike_only, untagged, tag_a, tag_b])
    db_session.commit()
    db_session.add_all(
        [
            GameTag(game_id=seed_game.id, tag_id=tag_a.id),
            GameTag(game_id=seed_game.id, tag_id=tag_b.id),
            GameTag(game_id=roguelike_only.id, tag_id=tag_a.id),
        ]
    )
    db_session.commit()
    return tag_a, tag_b


def test_list_games_tag_match_all_requires_every_selected_tag(auth_client, db_session, seed_game):
    tag_a, tag_b = _seed_tagged_games(db_session, seed_game)
    params = [("tagId", tag_a.id), ("tagId", tag_b.id)]

    any_response = auth_client.get("/api/games", params=params)
    assert {g["name"] for g in any_response.json()} == {"Test Game", "Roguelike Only"}

    all_response = auth_client.get("/api/games", params=[*params, ("tagMatchAll", "true")])
    assert [g["name"] for g in all_response.json()] == ["Test Game"]


def test_list_games_tag_match_all_with_exclude_hides_only_games_with_every_tag(
    auth_client, db_session, seed_game
):
    tag_a, tag_b = _seed_tagged_games(db_session, seed_game)

    response = auth_client.get(
        "/api/games",
        params=[("tagId", tag_a.id), ("tagId", tag_b.id), ("tagMatchAll", "true"), ("tagExclude", "true")],
    )

    assert [g["name"] for g in response.json()] == ["Roguelike Only", "Untagged"]


def test_list_games_platform_format_and_storefront_match_all_need_a_copy_for_each_value(
    auth_client, db_session, seed_game, seed_platform, seed_pc_platform
):
    single_copy = Game(igdb_id=2402, name="PS5 Only", category=GameCategory.MAIN_GAME)
    db_session.add(single_copy)
    db_session.commit()
    db_session.add_all(
        [
            LibraryItem(
                game_id=seed_game.id,
                platform_id=seed_platform.id,
                status=LibraryStatus.OWNED,
                format=MediaFormat.DIGITAL,
                digital_storefront="PlayStation Store",
            ),
            LibraryItem(
                game_id=seed_game.id,
                platform_id=seed_pc_platform.id,
                status=LibraryStatus.OWNED,
                format=MediaFormat.DIGITAL,
                digital_storefront="Steam",
            ),
            LibraryItem(
                game_id=seed_game.id,
                platform_id=seed_platform.id,
                status=LibraryStatus.OWNED,
                format=MediaFormat.PHYSICAL,
            ),
            LibraryItem(
                game_id=single_copy.id,
                platform_id=seed_platform.id,
                status=LibraryStatus.OWNED,
                format=MediaFormat.DIGITAL,
                digital_storefront="Steam",
            ),
        ]
    )
    db_session.commit()

    platforms = [("platformId", seed_platform.id), ("platformId", seed_pc_platform.id)]
    response = auth_client.get("/api/games", params=platforms)
    assert {g["name"] for g in response.json()} == {"Test Game", "PS5 Only"}
    response = auth_client.get("/api/games", params=[*platforms, ("platformMatchAll", "true")])
    assert [g["name"] for g in response.json()] == ["Test Game"]

    formats = [("format", "physical"), ("format", "digital"), ("formatMatchAll", "true")]
    response = auth_client.get("/api/games", params=formats)
    assert [g["name"] for g in response.json()] == ["Test Game"]

    storefronts = [("storefront", "Steam"), ("storefront", "PlayStation Store"), ("storefrontMatchAll", "true")]
    response = auth_client.get("/api/games", params=storefronts)
    assert [g["name"] for g in response.json()] == ["Test Game"]


def test_list_games_collection_and_franchise_match_all(auth_client, db_session, seed_game):
    other_game = Game(igdb_id=2403, name="Other Game", category=GameCategory.MAIN_GAME)
    collection_a = Collection(igdb_id=2404, name="Collection A", slug="collection-a")
    collection_b = Collection(igdb_id=2405, name="Collection B", slug="collection-b")
    franchise_a = Franchise(igdb_id=2406, name="Franchise A", slug="franchise-a")
    franchise_b = Franchise(igdb_id=2407, name="Franchise B", slug="franchise-b")
    db_session.add_all([other_game, collection_a, collection_b, franchise_a, franchise_b])
    db_session.commit()
    db_session.add_all(
        [
            GameCollection(game_id=seed_game.id, collection_id=collection_a.id),
            GameCollection(game_id=seed_game.id, collection_id=collection_b.id),
            GameCollection(game_id=other_game.id, collection_id=collection_a.id),
            GameFranchise(game_id=seed_game.id, franchise_id=franchise_a.id),
            GameFranchise(game_id=seed_game.id, franchise_id=franchise_b.id),
            GameFranchise(game_id=other_game.id, franchise_id=franchise_b.id),
        ]
    )
    db_session.commit()

    response = auth_client.get(
        "/api/games",
        params=[("collectionId", collection_a.id), ("collectionId", collection_b.id), ("collectionMatchAll", "true")],
    )
    assert [g["name"] for g in response.json()] == ["Test Game"]

    response = auth_client.get(
        "/api/games",
        params=[("franchiseId", franchise_a.id), ("franchiseId", franchise_b.id), ("franchiseMatchAll", "true")],
    )
    assert [g["name"] for g in response.json()] == ["Test Game"]


def _seed_play_statuses(db_session, seed_game, seed_platform, seed_pc_platform):
    """Test Game: Playing on PS5 + Completed on PC. Abandoned Game: Abandoned. Fresh Game:
    no progress row at all. Explicit None: a progress row whose status was left at none."""
    abandoned = Game(igdb_id=2408, name="Abandoned Game", category=GameCategory.MAIN_GAME)
    fresh = Game(igdb_id=2409, name="Fresh Game", category=GameCategory.MAIN_GAME)
    explicit_none = Game(igdb_id=2410, name="Explicit None", category=GameCategory.MAIN_GAME)
    db_session.add_all([abandoned, fresh, explicit_none])
    db_session.commit()
    db_session.add_all(
        [
            GameProgress(game_id=seed_game.id, platform_id=seed_platform.id, play_status=PlayStatus.PLAYING),
            GameProgress(game_id=seed_game.id, platform_id=seed_pc_platform.id, play_status=PlayStatus.COMPLETED),
            GameProgress(game_id=abandoned.id, platform_id=seed_platform.id, play_status=PlayStatus.ABANDONED),
            GameProgress(game_id=explicit_none.id, platform_id=seed_platform.id, play_status=PlayStatus.NONE),
        ]
    )
    db_session.commit()


def test_list_games_filters_by_play_status_on_any_platform(
    auth_client, db_session, seed_game, seed_platform, seed_pc_platform
):
    _seed_play_statuses(db_session, seed_game, seed_platform, seed_pc_platform)

    # Test Game's card shows Playing (the priority pick), but its PC copy is Completed, so
    # it still matches a Completed filter.
    response = auth_client.get("/api/games", params={"playStatus": "completed"})
    assert [g["name"] for g in response.json()] == ["Test Game"]

    response = auth_client.get("/api/games", params=[("playStatus", "abandoned"), ("playStatus", "playing")])
    assert [g["name"] for g in response.json()] == ["Abandoned Game", "Test Game"]


def test_list_games_play_status_none_means_not_started_on_any_platform(
    auth_client, db_session, seed_game, seed_platform, seed_pc_platform
):
    _seed_play_statuses(db_session, seed_game, seed_platform, seed_pc_platform)

    response = auth_client.get("/api/games", params={"playStatus": "none"})
    assert [g["name"] for g in response.json()] == ["Explicit None", "Fresh Game"]

    response = auth_client.get("/api/games", params=[("playStatus", "none"), ("playStatus", "abandoned")])
    assert [g["name"] for g in response.json()] == ["Abandoned Game", "Explicit None", "Fresh Game"]


def test_list_games_play_status_match_all_and_exclude(
    auth_client, db_session, seed_game, seed_platform, seed_pc_platform
):
    _seed_play_statuses(db_session, seed_game, seed_platform, seed_pc_platform)
    both = [("playStatus", "playing"), ("playStatus", "completed")]

    response = auth_client.get("/api/games", params=[*both, ("playStatusMatchAll", "true")])
    assert [g["name"] for g in response.json()] == ["Test Game"]

    response = auth_client.get("/api/games", params={"playStatus": "completed", "playStatusExclude": "true"})
    assert [g["name"] for g in response.json()] == ["Abandoned Game", "Explicit None", "Fresh Game"]

def test_list_games_defaults_to_name_ascending(auth_client, db_session):
    db_session.add_all(
        [
            Game(igdb_id=2300, name="Zelda", category=GameCategory.MAIN_GAME),
            Game(igdb_id=2301, name="Astro Bot", category=GameCategory.MAIN_GAME),
        ]
    )
    db_session.commit()

    response = auth_client.get("/api/games")

    assert [g["name"] for g in response.json()] == ["Astro Bot", "Zelda"]


def test_list_games_sort_by_name(auth_client, db_session):
    db_session.add_all(
        [
            Game(igdb_id=2302, name="Zelda", category=GameCategory.MAIN_GAME),
            Game(igdb_id=2303, name="Astro Bot", category=GameCategory.MAIN_GAME),
        ]
    )
    db_session.commit()

    response = auth_client.get("/api/games", params={"sort": "name_asc"})
    assert [g["name"] for g in response.json()] == ["Astro Bot", "Zelda"]

    response = auth_client.get("/api/games", params={"sort": "name_desc"})
    assert [g["name"] for g in response.json()] == ["Zelda", "Astro Bot"]


def test_list_games_sort_by_release_date(auth_client, db_session):
    older = Game(igdb_id=2304, name="Older Game", category=GameCategory.MAIN_GAME, first_release_date=1000)
    newer = Game(igdb_id=2305, name="Newer Game", category=GameCategory.MAIN_GAME, first_release_date=2000)
    db_session.add_all([older, newer])
    db_session.commit()

    response = auth_client.get("/api/games", params={"sort": "release_date_asc"})
    assert [g["name"] for g in response.json()] == ["Older Game", "Newer Game"]

    response = auth_client.get("/api/games", params={"sort": "release_date_desc"})
    assert [g["name"] for g in response.json()] == ["Newer Game", "Older Game"]


def test_list_games_sort_by_date_added(auth_client, db_session):
    first = Game(igdb_id=2306, name="Zelda", category=GameCategory.MAIN_GAME)
    second = Game(igdb_id=2307, name="Astro Bot", category=GameCategory.MAIN_GAME)
    first.created_at = datetime(2026, 1, 1, tzinfo=UTC)
    second.created_at = datetime(2026, 2, 1, tzinfo=UTC)
    db_session.add_all([first, second])
    db_session.commit()

    response = auth_client.get("/api/games", params={"sort": "date_added_desc"})
    assert [g["name"] for g in response.json()] == ["Astro Bot", "Zelda"]

    response = auth_client.get("/api/games", params={"sort": "date_added_asc"})
    assert [g["name"] for g in response.json()] == ["Zelda", "Astro Bot"]


def _sorted_names(auth_client, sort: str) -> list[str]:
    return [g["name"] for g in auth_client.get("/api/games", params={"sort": sort}).json()]


def test_list_games_sort_keeps_empty_values_last(auth_client, db_session):
    db_session.add_all(
        [
            Game(igdb_id=2310, name="Undated", category=GameCategory.MAIN_GAME),
            Game(igdb_id=2311, name="Old", category=GameCategory.MAIN_GAME, first_release_date=100),
            Game(igdb_id=2312, name="New", category=GameCategory.MAIN_GAME, first_release_date=200),
        ]
    )
    db_session.commit()

    assert _sorted_names(auth_client, "release_date_asc") == ["Old", "New", "Undated"]
    assert _sorted_names(auth_client, "release_date_desc") == ["New", "Old", "Undated"]


def test_list_games_sort_by_type(auth_client, db_session):
    db_session.add_all(
        [
            Game(igdb_id=2320, name="Bundle", category=GameCategory.BUNDLE),
            Game(igdb_id=2321, name="Remaster", category=GameCategory.REMASTER),
            Game(igdb_id=2322, name="Main B", category=GameCategory.MAIN_GAME),
            Game(igdb_id=2323, name="Main A", category=GameCategory.MAIN_GAME),
            Game(igdb_id=2324, name="Unknown", category=None),
        ]
    )
    db_session.commit()

    assert _sorted_names(auth_client, "type_asc") == ["Main A", "Main B", "Remaster", "Bundle", "Unknown"]
    assert _sorted_names(auth_client, "type_desc") == ["Bundle", "Remaster", "Main A", "Main B", "Unknown"]


def test_list_games_sort_by_platforms(auth_client, db_session, seed_platform, seed_pc_platform):
    ps5 = Game(igdb_id=2330, name="On PS5", category=GameCategory.MAIN_GAME)
    pc = Game(igdb_id=2331, name="On PC", category=GameCategory.MAIN_GAME)
    none = Game(igdb_id=2332, name="No Copy", category=GameCategory.MAIN_GAME)
    db_session.add_all([ps5, pc, none])
    db_session.flush()
    db_session.add_all(
        [
            LibraryItem(game_id=ps5.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED),
            LibraryItem(game_id=pc.id, platform_id=seed_pc_platform.id, status=LibraryStatus.WISHLIST),
        ]
    )
    db_session.commit()

    # "PC (Microsoft Windows)" before "PlayStation 5"; no copy last either way.
    assert _sorted_names(auth_client, "platforms_asc") == ["On PC", "On PS5", "No Copy"]
    assert _sorted_names(auth_client, "platforms_desc") == ["On PS5", "On PC", "No Copy"]


def test_list_games_sort_by_play_status_and_rating(auth_client, db_session, seed_platform):
    games = {
        name: Game(igdb_id=2340 + index, name=name, category=GameCategory.MAIN_GAME)
        for index, name in enumerate(["Playing", "Backlog", "Completed", "Untracked"])
    }
    db_session.add_all(games.values())
    db_session.flush()
    db_session.add_all(
        [
            GameProgress(game_id=games["Playing"].id, platform_id=seed_platform.id, play_status=PlayStatus.PLAYING),
            GameProgress(game_id=games["Backlog"].id, platform_id=seed_platform.id, play_status=PlayStatus.BACKLOG),
            GameProgress(game_id=games["Completed"].id, platform_id=seed_platform.id, play_status=PlayStatus.COMPLETED),
        ]
    )
    games["Playing"].user_rating = 6
    games["Completed"].user_rating = 9
    db_session.commit()

    assert _sorted_names(auth_client, "play_status_asc") == ["Playing", "Backlog", "Completed", "Untracked"]
    assert _sorted_names(auth_client, "play_status_desc") == ["Completed", "Backlog", "Playing", "Untracked"]
    assert _sorted_names(auth_client, "rating_desc") == ["Completed", "Playing", "Backlog", "Untracked"]
    assert _sorted_names(auth_client, "rating_asc") == ["Playing", "Completed", "Backlog", "Untracked"]


def test_list_games_sort_by_library(auth_client, db_session, seed_platform, seed_pc_platform):
    games = {
        name: Game(igdb_id=2350 + index, name=name, category=GameCategory.MAIN_GAME)
        for index, name in enumerate(["Both", "Owned", "Wishlisted", "Neither"])
    }
    db_session.add_all(games.values())
    db_session.flush()
    db_session.add_all(
        [
            LibraryItem(game_id=games["Both"].id, platform_id=seed_platform.id, status=LibraryStatus.OWNED),
            LibraryItem(game_id=games["Both"].id, platform_id=seed_pc_platform.id, status=LibraryStatus.WISHLIST),
            LibraryItem(game_id=games["Owned"].id, platform_id=seed_platform.id, status=LibraryStatus.OWNED),
            LibraryItem(game_id=games["Wishlisted"].id, platform_id=seed_platform.id, status=LibraryStatus.WISHLIST),
        ]
    )
    db_session.commit()

    assert _sorted_names(auth_client, "library_asc") == ["Both", "Owned", "Wishlisted", "Neither"]
    assert _sorted_names(auth_client, "library_desc") == ["Wishlisted", "Owned", "Both", "Neither"]


def test_list_games_sort_by_labels(auth_client, db_session, monkeypatch):
    from app.services import insight_service

    on_sale = Game(igdb_id=2360, name="On Sale", category=GameCategory.MAIN_GAME)
    missing = Game(igdb_id=2361, name="Missing", category=GameCategory.MAIN_GAME, auto_discovered=True)
    custom = Game(igdb_id=None, name="Custom", category=GameCategory.MAIN_GAME)
    plain = Game(igdb_id=2362, name="A Plain Game", category=GameCategory.MAIN_GAME)
    db_session.add_all([on_sale, missing, custom, plain])
    db_session.commit()
    monkeypatch.setattr(insight_service, "get_on_sale_game_ids", lambda db: frozenset({on_sale.id}))

    assert _sorted_names(auth_client, "labels_asc") == ["On Sale", "Missing", "Custom", "A Plain Game"]
    assert _sorted_names(auth_client, "labels_desc") == ["Custom", "Missing", "On Sale", "A Plain Game"]


def test_get_game_detail_includes_parent_name(auth_client, db_session, seed_game):
    addon = Game(igdb_id=2002, name="Test Game DLC", category=GameCategory.DLC_ADDON, parent_game_id=seed_game.id)
    db_session.add(addon)
    db_session.commit()

    response = auth_client.get(f"/api/games/{addon.uuid}")

    assert response.status_code == 200
    body = response.json()
    assert body["parentGameId"] == seed_game.id
    assert body["parentGameName"] == "Test Game"
    assert body["parentGameSlug"] == "test-game"
    assert body["category"] == "dlc_addon"


def test_owned_and_wishlisted_are_false_with_no_library_items(auth_client, seed_game):
    list_response = auth_client.get("/api/games")
    detail_response = auth_client.get(f"/api/games/{seed_game.slug}")

    assert list_response.json()[0]["owned"] is False
    assert list_response.json()[0]["wishlisted"] is False
    assert detail_response.json()["owned"] is False
    assert detail_response.json()["wishlisted"] is False


def test_owned_is_computed_fresh_not_stored(auth_client, db_session, seed_game, seed_platform):
    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()

    response = auth_client.get(f"/api/games/{seed_game.slug}")
    assert response.json()["owned"] is True
    assert response.json()["wishlisted"] is False

    list_response = auth_client.get("/api/games")
    assert list_response.json()[0]["owned"] is True


def test_wishlisted_true_for_wishlist_item(auth_client, db_session, seed_game):
    db_session.add(LibraryItem(game_id=seed_game.id, status=LibraryStatus.WISHLIST))
    db_session.commit()

    response = auth_client.get(f"/api/games/{seed_game.slug}")
    assert response.json()["owned"] is False
    assert response.json()["wishlisted"] is True


def test_addon_owned_status_is_independent_of_parent(auth_client, db_session, seed_game, seed_platform):
    addon = Game(igdb_id=2002, name="Test Game DLC", category=GameCategory.DLC_ADDON, parent_game_id=seed_game.id)
    db_session.add(addon)
    db_session.commit()
    db_session.add(LibraryItem(game_id=addon.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()

    addons_response = auth_client.get(f"/api/games/{seed_game.id}/addons")
    [addon_body] = addons_response.json()
    assert addon_body["owned"] is True

    parent_response = auth_client.get(f"/api/games/{seed_game.slug}")
    assert parent_response.json()["owned"] is False


def test_get_game_detail_includes_steam_app_id_when_matched(auth_client, db_session, seed_game):
    from app.models.steam import SteamLibraryEntry

    db_session.add(SteamLibraryEntry(steam_app_id=220, steam_name="Test Game", game_id=seed_game.id))
    db_session.commit()

    response = auth_client.get(f"/api/games/{seed_game.uuid}")

    assert response.status_code == 200
    assert response.json()["steamAppId"] == 220


def test_get_game_detail_steam_app_id_is_null_when_unmatched(auth_client, seed_game):
    response = auth_client.get(f"/api/games/{seed_game.uuid}")

    assert response.status_code == 200
    assert response.json()["steamAppId"] is None


def test_get_game_detail_404_for_missing_game(auth_client):
    response = auth_client.get("/api/games/999999")

    assert response.status_code == 404


def test_get_game_by_numeric_id_404s(auth_client, seed_game):
    """The whole point of switching to slug/uuid lookup — the old numeric id must not
    resolve, or it'd still be enumerable."""
    response = auth_client.get(f"/api/games/{seed_game.id}")

    assert response.status_code == 404


def test_get_game_by_bare_uuid_resolves_without_a_slug(auth_client, seed_game):
    response = auth_client.get(f"/api/games/{seed_game.uuid}")

    assert response.status_code == 200
    assert response.json()["id"] == seed_game.id


def test_get_game_with_uuid_shaped_igdb_slug_resolves_by_slug(auth_client, db_session, seed_game):
    """Some IGDB slugs (e.g. Need for Speed: Most Wanted) end in a UUID-shaped string that is
    not the game's own uuid — that must fall back to slug lookup instead of 404ing."""
    seed_game.slug = "need-for-speed-most-wanted-53b9fef3-adb4-41a0-8ca0-ffcbb0060467"
    db_session.commit()

    response = auth_client.get(f"/api/games/{seed_game.slug}")

    assert response.status_code == 200
    assert response.json()["id"] == seed_game.id


def test_list_addons_404_for_missing_parent(auth_client):
    response = auth_client.get("/api/games/999999/addons")

    assert response.status_code == 404


def test_list_addons_returns_children(auth_client, db_session, seed_game):
    addon = Game(igdb_id=2002, name="Test Game DLC", category=GameCategory.DLC_ADDON, parent_game_id=seed_game.id)
    db_session.add(addon)
    db_session.commit()

    response = auth_client.get(f"/api/games/{seed_game.id}/addons")

    assert response.status_code == 200
    assert [a["name"] for a in response.json()] == ["Test Game DLC"]


def test_delete_game_cascades_to_addons_and_library_items(auth_client, db_session, seed_game, seed_platform):
    addon = Game(igdb_id=2002, name="Test Game DLC", category=GameCategory.DLC_ADDON, parent_game_id=seed_game.id)
    db_session.add(addon)
    db_session.commit()

    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.add(LibraryItem(game_id=addon.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()

    # Captured before the delete — the route commits on this same shared session, which
    # expires these ORM objects, so reading .id off them afterwards would try to reload
    # an already-deleted row and raise ObjectDeletedError.
    game_ids = [seed_game.id, addon.id]

    response = auth_client.delete(f"/api/games/{game_ids[0]}")
    assert response.status_code == 204

    assert db_session.query(Game).filter(Game.id.in_(game_ids)).count() == 0
    assert db_session.query(LibraryItem).filter(LibraryItem.game_id.in_(game_ids)).count() == 0


def test_delete_game_404_for_missing_game(auth_client):
    response = auth_client.delete("/api/games/999999")

    assert response.status_code == 404


def test_delete_game_cascades_to_progress_sessions_notes_and_tags(auth_client, db_session, seed_game, seed_platform):
    db_session.add(GameProgress(game_id=seed_game.id, platform_id=seed_platform.id))
    db_session.add(
        PlaySession(
            game_id=seed_game.id, platform_id=seed_platform.id, started_at=datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
        )
    )
    db_session.add(Note(game_id=seed_game.id, body="note"))
    tag = Tag(name="Cascade Test Tag")
    db_session.add(tag)
    db_session.commit()
    db_session.add(GameTag(game_id=seed_game.id, tag_id=tag.id))
    db_session.commit()

    game_id = seed_game.id
    response = auth_client.delete(f"/api/games/{game_id}")

    assert response.status_code == 204
    assert db_session.query(GameProgress).filter_by(game_id=game_id).count() == 0
    assert db_session.query(PlaySession).filter_by(game_id=game_id).count() == 0
    assert db_session.query(Note).filter_by(game_id=game_id).count() == 0
    assert db_session.query(GameTag).filter_by(game_id=game_id).count() == 0
    # The tag itself (a shared, global record) must survive — only the link is cascaded.
    assert db_session.query(Tag).filter_by(id=tag.id).count() == 1


def test_list_games_required_collection_id_scopes_and_still_ands_with_other_filters(
    auth_client, db_session, seed_game, seed_platform
):
    """required_collection_id is an always-applied AND-scope, independent of the ordinary
    collectionId OR-filter — a Collection detail page's own hard scope stays in force even
    while the user filters further (e.g. by platform) on top of it."""
    other_game = Game(igdb_id=2220, name="Other Game", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    collection = Collection(igdb_id=9001, name="Some Collection", slug="some-collection")
    db_session.add(collection)
    db_session.commit()
    db_session.add(GameCollection(game_id=seed_game.id, collection_id=collection.id))
    db_session.add(LibraryItem(game_id=seed_game.id, platform_id=seed_platform.id, status=LibraryStatus.OWNED))
    db_session.commit()

    scoped_response = auth_client.get("/api/games", params={"requiredCollectionId": collection.id})
    assert [g["name"] for g in scoped_response.json()] == ["Test Game"]

    combined_response = auth_client.get(
        "/api/games", params={"requiredCollectionId": collection.id, "platformId": seed_platform.id}
    )
    assert [g["name"] for g in combined_response.json()] == ["Test Game"]

    unmatched_platform = Platform(name="Unrelated Platform", slug="unrelated-platform")
    db_session.add(unmatched_platform)
    db_session.commit()
    empty_response = auth_client.get(
        "/api/games", params={"requiredCollectionId": collection.id, "platformId": unmatched_platform.id}
    )
    assert empty_response.json() == []


def test_list_games_required_franchise_id_scopes(auth_client, db_session, seed_game):
    other_game = Game(igdb_id=2221, name="Other Game", category=GameCategory.MAIN_GAME)
    db_session.add(other_game)
    franchise = Franchise(igdb_id=9002, name="Some Series", slug="some-series")
    db_session.add(franchise)
    db_session.commit()
    db_session.add(GameFranchise(game_id=seed_game.id, franchise_id=franchise.id))
    db_session.commit()

    response = auth_client.get("/api/games", params={"requiredFranchiseId": franchise.id})

    assert [g["name"] for g in response.json()] == ["Test Game"]


def test_bulk_import_requires_auth(client):
    response = client.post("/api/games/bulk-import", json={"igdbIds": [1]})

    assert response.status_code == 401


def test_bulk_import_starts_and_completes(auth_client, db_session, monkeypatch):
    async def fake_import(db, igdb_client, igdb_id):
        game = Game(igdb_id=igdb_id, name=f"Bulk Game {igdb_id}", category=GameCategory.MAIN_GAME)
        db.add(game)
        db.commit()
        return _fake_game_with_status(game)

    monkeypatch.setattr(game_service, "import_game_from_igdb", fake_import)

    response = auth_client.post("/api/games/bulk-import", json={"igdbIds": [9001, 9002]})

    assert response.status_code == 202
    assert response.json()["status"] == "running"

    status_body = _wait_for_bulk_import_completion(auth_client)
    assert status_body["status"] == "completed"
    assert status_body["result"]["total"] == 2
    assert status_body["result"]["succeeded"] == 2
    assert db_session.query(Game).filter(Game.igdb_id.in_([9001, 9002])).count() == 2


def test_bulk_import_creates_library_items_from_defaults(auth_client, db_session, seed_platform, monkeypatch):
    async def fake_import(db, igdb_client, igdb_id):
        game = Game(igdb_id=igdb_id, name="Bulk Library Game", category=GameCategory.MAIN_GAME)
        db.add(game)
        db.commit()
        return _fake_game_with_status(game)

    monkeypatch.setattr(game_service, "import_game_from_igdb", fake_import)

    response = auth_client.post(
        "/api/games/bulk-import",
        json={
            "igdbIds": [9003],
            "libraryDefaults": {"status": "owned", "platformId": seed_platform.id, "format": "physical"},
        },
    )

    assert response.status_code == 202
    status_body = _wait_for_bulk_import_completion(auth_client)
    assert status_body["status"] == "completed"

    imported_game = db_session.query(Game).filter_by(igdb_id=9003).one()
    library_items = db_session.query(LibraryItem).filter_by(game_id=imported_game.id).all()
    assert len(library_items) == 1
    assert library_items[0].status == LibraryStatus.OWNED
    assert library_items[0].platform_id == seed_platform.id


def test_bulk_import_rejects_a_second_run_while_one_is_in_progress(auth_client, monkeypatch):
    import threading

    release = threading.Event()

    async def blocking_import(db, igdb_client, igdb_id):
        release.wait(timeout=2)
        raise RuntimeError("never reached")

    monkeypatch.setattr(game_service, "import_game_from_igdb", blocking_import)

    try:
        first = auth_client.post("/api/games/bulk-import", json={"igdbIds": [9004]})
        assert first.status_code == 202

        second = auth_client.post("/api/games/bulk-import", json={"igdbIds": [9005]})
        assert second.status_code == 409
    finally:
        release.set()
        time.sleep(0.05)


def test_bulk_import_status_requires_auth(client):
    response = client.get("/api/games/bulk-import/status")

    assert response.status_code == 401


def test_bulk_import_status_defaults_to_idle(auth_client):
    response = auth_client.get("/api/games/bulk-import/status")

    assert response.status_code == 200
    assert response.json()["status"] == "idle"


def test_acknowledge_bulk_import_status_requires_auth(client):
    response = client.post("/api/games/bulk-import/status/acknowledge")

    assert response.status_code == 401


def test_acknowledge_bulk_import_status_resets_a_completed_run(auth_client, db_session, monkeypatch):
    async def fake_import(db, igdb_client, igdb_id):
        game = Game(igdb_id=igdb_id, name="Bulk Ack Game", category=GameCategory.MAIN_GAME)
        db.add(game)
        db.commit()
        return _fake_game_with_status(game)

    monkeypatch.setattr(game_service, "import_game_from_igdb", fake_import)

    auth_client.post("/api/games/bulk-import", json={"igdbIds": [9006]})
    _wait_for_bulk_import_completion(auth_client)

    ack_response = auth_client.post("/api/games/bulk-import/status/acknowledge")
    assert ack_response.status_code == 204
    assert auth_client.get("/api/games/bulk-import/status").json()["status"] == "idle"


def _copy(db_session, game, platform, status=LibraryStatus.OWNED, rom_extension=None):
    item = LibraryItem(game_id=game.id, platform_id=platform.id, status=status, format=MediaFormat.ROM)
    db_session.add(item)
    db_session.commit()
    if rom_extension:
        db_session.add(
            RomFile(
                library_item_id=item.id,
                original_filename=f"game.{rom_extension}",
                stored_filename=f"stored-{item.id}",
                size_bytes=1024,
                extension=rom_extension,
            )
        )
        db_session.commit()
    return item


def _listed(auth_client, name):
    return next(g for g in auth_client.get("/api/games").json() if g["name"] == name)


def test_list_games_exposes_each_games_copy_platforms_once_each(auth_client, db_session, seed_game, seed_platform):
    nes = Platform(name="Nintendo Entertainment System", slug="nes", abbreviation="NES")
    db_session.add(nes)
    db_session.commit()
    _copy(db_session, seed_game, seed_platform)
    _copy(db_session, seed_game, seed_platform)
    _copy(db_session, seed_game, nes, status=LibraryStatus.WISHLIST)

    # Abbreviation when there is one, else the name; wishlisted copies count too.
    assert _listed(auth_client, "Test Game")["libraryPlatforms"] == ["NES", "PlayStation 5"]


def test_list_games_platforms_is_empty_without_copies(auth_client, seed_game):
    assert _listed(auth_client, "Test Game")["libraryPlatforms"] == []


def test_list_games_playable_needs_an_owned_copy_with_a_runnable_rom(auth_client, db_session, seed_game):
    nes = Platform(name="Nintendo Entertainment System", slug="nes")
    ps2 = Platform(name="Sony PlayStation 2", slug="ps2")
    wishlisted = Game(igdb_id=3001, name="Wishlisted NES Game", category=GameCategory.MAIN_GAME)
    unsupported = Game(igdb_id=3002, name="PS2 Game", category=GameCategory.MAIN_GAME)
    db_session.add_all([nes, ps2, wishlisted, unsupported])
    db_session.commit()
    _copy(db_session, seed_game, nes, rom_extension="nes")
    _copy(db_session, wishlisted, nes, status=LibraryStatus.WISHLIST, rom_extension="nes")
    _copy(db_session, unsupported, ps2, rom_extension="iso")

    assert _listed(auth_client, "Test Game")["playable"] is True
    assert _listed(auth_client, "Wishlisted NES Game")["playable"] is False
    assert _listed(auth_client, "PS2 Game")["playable"] is False


def test_other_summary_endpoints_leave_platforms_and_playable_empty(auth_client, db_session, seed_game, seed_platform):
    addon = Game(igdb_id=2003, name="Test Game DLC", category=GameCategory.DLC_ADDON, parent_game_id=seed_game.id)
    db_session.add(addon)
    db_session.commit()
    _copy(db_session, addon, seed_platform)

    [listed_addon] = auth_client.get(f"/api/games/{seed_game.id}/addons").json()
    assert listed_addon["libraryPlatforms"] == []
    assert listed_addon["playable"] is False
