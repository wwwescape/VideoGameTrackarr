"""Helpers for the query-count tests (test_query_counts.py): a seeder that builds a library of
any size with every relationship the list endpoints read, and a counter for the SQL statements
one request runs. An endpoint whose count grows with the library's size runs a query per row
(an N+1)."""

from contextlib import contextmanager
from datetime import UTC, date, datetime

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.models.catalog import (
    Artwork,
    Collection,
    Company,
    CompanyRole,
    Franchise,
    Game,
    GameCategory,
    GameCollection,
    GameCompany,
    GameFranchise,
    GameGenre,
    GamePlatform,
    GameVideo,
    Genre,
    Platform,
    Region,
    ReleaseDate,
    Screenshot,
)
from app.models.events import Event, EventGame, EventNetwork, EventVideo
from app.models.hardware import (
    Accessory,
    AccessoryCompatibility,
    AccessoryDeviceLink,
    AccessoryNote,
    AccessoryTag,
    AccessoryType,
    Color,
    Device,
    DeviceNote,
    DeviceTag,
    DeviceType,
    HardwarePlatform,
    HardwareReferenceEntry,
    Manufacturer,
    StorageVariant,
    UserAccessory,
    UserDevice,
)
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
    Tag,
)
from app.models.platprices import PlatPricesCache


@contextmanager
def count_queries(engine: Engine):
    """Counts the SQL statements run on `engine` inside the block: `with count_queries(e) as
    queries: ...`, then `len(queries)`."""
    statements: list[str] = []

    def _record(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", _record)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", _record)


def seed_library(db: Session, size: int, first: int = 0) -> None:
    """`size` of everything: games (each owned and wishlisted for sales, with progress, a play
    session, a note, a tag, genre, company, series, franchise, media and prices), add-ons,
    devices (owned and wishlisted) and accessories (owned), tagged, noted and linked, and an
    upcoming event per game.

    Every row gets its own platform, region, manufacturer and so on: rows sharing one related
    object would hide an N+1, since SQLAlchemy loads a shared object once and then finds it in
    the session for every later row. Rows are numbered from `first`, so a second call with
    `first` past the last one adds more rows to the same library."""
    now = datetime.now(UTC)
    start = int(now.timestamp())

    for i in range(first, first + size):
        # Alternate the two price providers' platforms (ITAD: PC, PlatPrices: PS5).
        is_pc = i % 2 == 0
        platform = Platform(name=f"Platform {i}", slug="win" if is_pc else "ps5")
        storefront = "Steam" if is_pc else "PlayStation Store"
        region = Region(name=f"Region {i}")
        hardware_platform = HardwarePlatform(name=f"Hardware platform {i}")
        manufacturer = Manufacturer(name=f"Manufacturer {i}")
        device_type = DeviceType(name=f"Device type {i}")
        accessory_type = AccessoryType(name=f"Accessory type {i}")
        event_row = Event(
            igdb_id=900_000 + i,
            name=f"Showcase {i}",
            slug=f"showcase-{i}",
            start_time=start + 3_600 * (i + 1),
            end_time=start + 3_600 * (i + 2),
        )
        db.add_all([platform, region, hardware_platform, manufacturer, device_type, accessory_type, event_row])
        tag = Tag(name=f"Tag {i}")
        genre = Genre(name=f"Genre {i}", slug=f"genre-{i}")
        company = Company(name=f"Company {i}", slug=f"company-{i}")
        franchise = Franchise(name=f"Franchise {i}", slug=f"franchise-{i}")
        collection = Collection(name=f"Series {i}", slug=f"series-{i}")
        game = Game(
            igdb_id=100_000 + i,
            name=f"Game {i}",
            slug=f"game-{i}",
            category=GameCategory.MAIN_GAME,
            cover_url=f"https://images.igdb.com/igdb/image/upload/t_720p/co{i}.jpg",
            first_release_date=start + 86_400 * (i + 1),
        )
        db.add_all([tag, genre, company, franchise, collection, game])
        db.flush()
        addon = Game(
            igdb_id=200_000 + i,
            name=f"Game {i} DLC",
            slug=f"game-{i}-dlc",
            category=GameCategory.DLC_ADDON,
            parent_game_id=game.id,
        )
        db.add(addon)
        db.flush()

        db.add_all(
            [
                GamePlatform(game_id=game.id, platform_id=platform.id),
                GameGenre(game_id=game.id, genre_id=genre.id),
                GameCompany(game_id=game.id, company_id=company.id, role=CompanyRole.DEVELOPER),
                GameFranchise(game_id=game.id, franchise_id=franchise.id),
                GameCollection(game_id=game.id, collection_id=collection.id),
                GameCollection(game_id=addon.id, collection_id=collection.id),
                GameTag(game_id=game.id, tag_id=tag.id),
                Screenshot(game_id=game.id, url=f"https://images.igdb.com/s{i}.jpg"),
                Artwork(game_id=game.id, url=f"https://images.igdb.com/a{i}.jpg"),
                GameVideo(game_id=game.id, video_id=f"v{i}"),
                ReleaseDate(game_id=game.id, platform_id=platform.id, date=game.first_release_date),
                LibraryItem(
                    game_id=game.id,
                    platform_id=platform.id,
                    region_id=region.id,
                    status=LibraryStatus.OWNED,
                    format=MediaFormat.DIGITAL,
                    digital_storefront=storefront,
                    price=20.0,
                    acquired_at=date(2025, 1, 1),
                ),
                GameProgress(
                    game_id=game.id, platform_id=platform.id, play_status=PlayStatus.PLAYING, playtime_minutes=60
                ),
                PlaySession(game_id=game.id, platform_id=platform.id, started_at=now, duration_minutes=60),
                Note(game_id=game.id, body="A note"),
                EventGame(event_id=event_row.id, igdb_game_id=game.igdb_id, game_id=game.id, name=game.name),
                EventNetwork(event_id=event_row.id, network_type="YouTube", url=f"https://example.com/live/{i}"),
                EventVideo(event_id=event_row.id, name="Trailer", video_id=f"e{i}"),
            ]
        )
        db.add(
            LibraryItem(
                game_id=game.id,
                platform_id=platform.id,
                status=LibraryStatus.WISHLIST,
                format=MediaFormat.DIGITAL,
                digital_storefront=storefront,
                track_for_sales=True,
                target_price=10.0,
            )
        )
        if is_pc:
            db.add(
                ItadPriceCache(
                    game_id=game.id,
                    itad_game_id=f"itad-{i}",
                    current_price_amount=5.0,
                    current_price_currency="EUR",
                    current_shop_name="Steam",
                    current_cut=75,
                    deals=[{"shop_name": "Steam", "price_amount": 5.0, "price_currency": "EUR", "cut": 75}],
                    checked_at=now,
                )
            )
        else:
            db.add(
                PlatPricesCache(
                    game_id=game.id,
                    ppid=f"pp-{i}",
                    current_price_amount=5.0,
                    current_price_currency="EUR",
                    current_shop_name="PlayStation Store",
                    current_cut=75,
                    checked_at=now,
                )
            )

        color = Color(name=f"Colour {i}")
        storage = StorageVariant(name=f"{i} TB")
        device_reference = HardwareReferenceEntry(
            brand="Brand",
            generation=f"Generation {i}",
            artefact="Console",
            official_name=f"Reference console {i}",
            category="Home console",
            type="device",
        )
        accessory_reference = HardwareReferenceEntry(
            brand="Brand",
            generation=f"Generation {i}",
            artefact="Controller",
            official_name=f"Reference controller {i}",
            category="Controller",
            type="accessory",
        )
        db.add_all([color, storage, device_reference, accessory_reference])
        db.flush()
        device = Device(
            manufacturer_id=manufacturer.id,
            device_type_id=device_type.id,
            hardware_platform_id=hardware_platform.id,
            storage_variant_id=storage.id,
            color_id=color.id,
            hardware_reference_entry_id=device_reference.id,
            official_name=f"Console {i}",
        )
        accessory = Accessory(
            manufacturer_id=manufacturer.id,
            accessory_type_id=accessory_type.id,
            color_id=color.id,
            hardware_reference_entry_id=accessory_reference.id,
            official_name=f"Controller {i}",
        )
        db.add_all([device, accessory])
        db.flush()
        db.add_all(
            [
                UserDevice(device_id=device.id, status=LibraryStatus.OWNED),
                UserDevice(device_id=device.id, status=LibraryStatus.WISHLIST),
                UserAccessory(accessory_id=accessory.id, status=LibraryStatus.OWNED),
                DeviceTag(device_id=device.id, tag_id=tag.id),
                AccessoryTag(accessory_id=accessory.id, tag_id=tag.id),
                DeviceNote(device_id=device.id, body="A note"),
                AccessoryNote(accessory_id=accessory.id, body="A note"),
                AccessoryCompatibility(accessory_id=accessory.id, hardware_platform_id=hardware_platform.id),
                AccessoryDeviceLink(accessory_id=accessory.id, device_id=device.id),
            ]
        )
    db.commit()
