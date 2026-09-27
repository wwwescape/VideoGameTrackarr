import csv
import importlib.util
from pathlib import Path

from app.models.catalog import Platform
from app.repositories import platform_repository

REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATION = REPO_ROOT / "backend" / "alembic" / "versions" / "e1c5a9d3f7b2_backfill_platform_short_names.py"


def _load_migration():
    spec = importlib.util.spec_from_file_location("short_names_migration", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_igdb_link_fills_a_missing_abbreviation(db_session):
    platform = Platform(name="Nintendo Entertainment System", slug="nes", igdb_id=18)
    db_session.add(platform)
    db_session.commit()

    platform_repository.get_or_create_by_igdb(db_session, 18, "NES", "nes", "NES")

    assert platform.abbreviation == "NES"


def test_igdb_link_never_overwrites_an_existing_abbreviation(db_session):
    platform = Platform(name="Super Famicom", slug="sfam", igdb_id=58, abbreviation="SFAM")
    db_session.add(platform)
    db_session.commit()

    platform_repository.get_or_create_by_igdb(db_session, 58, "Super Famicom", "sfam", "SFC")

    assert platform.abbreviation == "SFAM"


def test_bare_slug_link_fills_a_missing_abbreviation(db_session):
    legacy = Platform(name="Nintendo 64", slug="n64")  # predates IGDB linking: no igdb_id
    db_session.add(legacy)
    db_session.commit()

    linked = platform_repository.get_or_create_by_igdb(db_session, 4, "Nintendo 64", "n64--1", "N64")

    assert linked.id == legacy.id
    assert linked.igdb_id == 4
    assert linked.abbreviation == "N64"
    assert linked.name == "Nintendo 64"


def test_migration_short_names_are_short_and_non_empty():
    migration = _load_migration()
    for slug, short_name in migration.SHORT_NAMES.items():
        assert short_name.strip(), slug
        assert len(short_name) <= 50, slug  # platforms.abbreviation is String(50)


def test_migration_hardware_short_names_match_the_csvs():
    """The migration backfills existing rows; the CSVs seed new instances — they must agree."""
    csv_short: dict[str, str] = {}
    for path in (REPO_ROOT / "docs" / "data" / "hardware").glob("*.csv"):
        with path.open(encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                csv_short[row["Generation"]] = row["Generation (Short)"]

    migration = _load_migration()
    for generation, short_name in migration.HARDWARE_GENERATION_SHORT_NAMES.items():
        assert csv_short.get(generation) == short_name, generation
    assert all(csv_short.values()), [g for g, s in csv_short.items() if not s]
