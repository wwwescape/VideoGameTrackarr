"""Game Shelf: the curated game cases (docs/data/game_cases/Game_Cases.csv), their seed, and
Settings > Game Cases' list and Show on shelf switch."""

import importlib.util

import pytest

from app.core.config import BACKEND_DIR
from app.models.catalog import Game, GameCategory, Platform
from app.models.game_cases import GameCase
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.services import game_case_catalog

# The newest migration that seeds the cases from a snapshot of the CSV.
_MIGRATION = BACKEND_DIR / "alembic" / "versions" / "890ae488ac83_sega_game_case_spine_logos.py"


def _load_migration():
    spec = importlib.util.spec_from_file_location("game_cases_migration", _MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_the_csv_is_valid_and_covers_the_standard_cases():
    rows = game_case_catalog.parse_csv()
    slugs = {row["platform_slug"] for row in rows}
    assert {"ps2", "ps4", "ps5", "switch", "xboxone", "ngc", "nds", "3ds"} <= slugs
    # Cartridge-only systems have no standard case; PC has its Games for Windows case.
    assert "win" in slugs
    assert not {"nes", "snes", "n64"} & slugs


def _contrast(first: str, second: str) -> float:
    """WCAG contrast ratio between two #rrggbb colours."""

    def luminance(hex_color: str) -> float:
        channels = [int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
        r, g, b = (c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels)
        return 0.2126 * r + 0.7152 * g + 0.0722 * b

    high, low = sorted((luminance(first), luminance(second)), reverse=True)
    return (high + 0.05) / (low + 0.05)


def test_every_title_is_readable_on_its_band():
    for row in game_case_catalog.parse_csv():
        ratio = _contrast(row["title_band_color"], row["title_text_color"])
        assert ratio >= 4.5, f"{row['platform_slug']}: title contrast {ratio:.2f} is below 4.5"


def test_the_latest_seed_migration_matches_the_csv():
    migration = _load_migration()
    seeded = [dict(zip(migration._COLUMNS, row, strict=True)) for row in migration._GAME_CASES]
    assert seeded == game_case_catalog.parse_csv()


@pytest.mark.parametrize(
    ("column", "value", "message"),
    [
        ("Case Color", "red", "isn't #rrggbb"),
        ("Height (mm)", "0", "sizes must be above 0"),
        ("Logo Band Height (%)", "60", "at most 50"),
        ("Logo", "logo.gif", "isn't a .svg, .png or .webp"),
        ("Logo", "../ps4.svg", "isn't a .svg, .png or .webp"),
        ("Logo Color", "white", "isn't #rrggbb"),
        ("Logo Line Color", "#fff", "isn't #rrggbb"),
        ("Case Top (mm)", "-1", "Case Top"),
        ("Case Top (mm)", "60", "Case Top"),
    ],
)
def test_a_malformed_row_is_refused(tmp_path, column, value, message):
    header = game_case_catalog.CSV_PATH.read_text(encoding="utf-8").splitlines()[0]
    values = dict(
        zip(
            header.split(","),
            [
                *("ps4", "PS4", "Blu-ray case", "171", "12", "6", "#000000", "#000000", "14"),
                *("", "", "", "#000000", "#ffffff"),
            ],
            strict=True,
        )
    )
    values[column] = value
    path = tmp_path / "cases.csv"
    path.write_text(header + "\n" + ",".join(values.values()) + "\n", encoding="utf-8")
    with pytest.raises(ValueError, match=message):
        game_case_catalog.parse_csv(path)


def test_every_logo_the_csv_names_is_in_the_assets_folder():
    missing = [
        row["logo"]
        for row in game_case_catalog.parse_csv()
        if row["logo"] and not (game_case_catalog.LOGO_DIR / row["logo"]).is_file()
    ]
    assert missing == []


def test_a_blank_logo_is_none(tmp_path):
    rows = game_case_catalog.parse_csv()
    assert all(row["logo"] is None or row["logo"].endswith((".svg", ".png", ".webp")) for row in rows)
    assert all(0 < row["logo_band_height_pct"] <= 50 for row in rows)


def test_blank_optional_colours_are_none():
    rows = {row["platform_slug"]: row for row in game_case_catalog.parse_csv()}
    assert rows["ps3"]["logo_line_color"] == "#d40000"
    assert rows["ps"]["logo_color"] is None
    assert rows["ps"]["logo_line_color"] is None


def test_a_duplicate_slug_is_refused(tmp_path):
    lines = game_case_catalog.CSV_PATH.read_text(encoding="utf-8").splitlines()
    path = tmp_path / "cases.csv"
    path.write_text("\n".join([*lines, lines[1]]) + "\n", encoding="utf-8")
    with pytest.raises(ValueError, match="listed twice"):
        game_case_catalog.parse_csv(path)


def test_a_reimport_updates_the_case_but_keeps_your_choice(db_session):
    row = next(row for row in game_case_catalog.parse_csv() if row["platform_slug"] == "ps4")
    case = game_case_catalog.upsert(db_session, row)
    case.shown = False
    db_session.commit()

    game_case_catalog.upsert(db_session, {**row, "case_color": "#123456", "height_mm": 170.0})
    db_session.commit()
    db_session.refresh(case)
    assert (case.case_color, case.height_mm, case.shown) == ("#123456", 170.0, False)
    assert db_session.query(GameCase).count() == 1


def test_bare_slug_drops_igdbs_suffix():
    assert game_case_catalog.bare_slug("ps4--1") == "ps4"
    assert game_case_catalog.bare_slug("PS5") == "ps5"
    assert game_case_catalog.bare_slug(None) is None


def _own(db_session, platform: Platform, name: str, fmt=MediaFormat.PHYSICAL, status=LibraryStatus.OWNED, **game):
    record = Game(name=name, category=game.pop("category", GameCategory.MAIN_GAME), **game)
    db_session.add(record)
    db_session.flush()
    db_session.add(LibraryItem(game_id=record.id, platform_id=platform.id, status=status, format=fmt))
    db_session.commit()
    return record


def test_settings_platforms_lists_cases_with_physical_game_counts(auth_client, db_session, game_shelf_lab):
    ps4 = Platform(
        name="PlayStation 4", slug="ps4", igdb_id=48, abbreviation="PS4", logo_url="https://images.igdb.com/ps4.png"
    )
    ps4_alt = Platform(name="PlayStation 4 (alt)", slug="ps4--1", igdb_id=4801)
    db_session.add_all([ps4, ps4_alt])
    db_session.commit()
    _own(db_session, ps4, "Physical")
    _own(db_session, ps4_alt, "Physical on the alt row")
    _own(db_session, ps4, "Digital", MediaFormat.DIGITAL)
    _own(db_session, ps4, "Wished", status=LibraryStatus.WISHLIST)
    parent = _own(db_session, ps4, "Base game")
    _own(db_session, ps4, "DLC", category=GameCategory.DLC_ADDON, parent_game_id=parent.id)

    body = auth_client.get("/api/game-cases").json()

    assert len(body) == len(game_case_catalog.parse_csv())
    assert [case["platformName"] for case in body] == sorted(case["platformName"] for case in body)
    ps4_case = next(case for case in body if case["platformSlug"] == "ps4")
    assert ps4_case["physicalGames"] == 3
    assert ps4_case["logoUrl"] == "https://images.igdb.com/ps4.png"
    assert ps4_case["abbreviation"] == "PS4"
    assert ps4_case["shown"] is True
    assert ps4_case["caseLabel"] == "Blu-ray case"
    assert {
        "heightMm",
        "spineMm",
        "caseColor",
        "logoBandColor",
        "logoBandHeightPct",
        "logo",
        "logoColor",
        "logoLineColor",
        "caseTopMm",
        "titleBandColor",
        "titleTextColor",
    } <= set(ps4_case)
    assert ps4_case["logoLineColor"] == "#ffffff"
    assert next(case for case in body if case["platformSlug"] == "ps5")["physicalGames"] == 0


def test_show_on_shelf_switch(auth_client, db_session, game_shelf_lab):
    case = db_session.query(GameCase).filter_by(platform_slug="switch").one()

    response = auth_client.put(f"/api/game-cases/{case.id}", json={"shown": False})

    assert response.status_code == 200
    assert response.json()["shown"] is False
    db_session.refresh(case)
    assert case.shown is False


def test_an_unknown_case_is_404(auth_client, game_shelf_lab):
    assert auth_client.put("/api/game-cases/99999", json={"shown": False}).status_code == 404


def test_game_cases_require_auth(client):
    assert client.get("/api/game-cases").status_code == 401
