"""The Game Shelf's predefined game cases: docs/data/game_cases/Game_Cases.csv, one row per
platform with a standard case. New installs get the rows from the seed migration; a later CSV
edit is picked up with `python -m scripts.import_game_cases`, which only rewrites the
reference columns and keeps each case's Show on shelf choice."""

import csv
import re
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import REPO_ROOT
from app.models.game_cases import GameCase

CSV_PATH = REPO_ROOT / "docs" / "data" / "game_cases" / "Game_Cases.csv"
LOGO_DIR = REPO_ROOT / "frontend" / "assets" / "game-cases"
_HEX = re.compile(r"^#[0-9a-f]{6}$")
_LOGO_FILE = re.compile(r"^[a-z0-9][a-z0-9._-]*\.(svg|png|webp)$")
_COLOR_COLUMNS = {
    "case_color": "Case Color",
    "logo_band_color": "Logo Band Color",
    "title_band_color": "Title Band Color",
    "title_text_color": "Title Text Color",
}
# Optional colours: blank means none (the logo in its own colours; no line under the band).
_OPTIONAL_COLOR_COLUMNS = {
    "logo_color": "Logo Color",
    "logo_line_color": "Logo Line Color",
}


def parse_csv(path: Path = CSV_PATH) -> list[dict[str, Any]]:
    """One dict per case, keyed by game_cases column (minus `shown`). Raises ValueError on a
    malformed row rather than seeding a broken case."""
    rows: list[dict[str, Any]] = []
    # utf-8-sig, as the other curated imports: copes with an Excel-saved BOM.
    with path.open(newline="", encoding="utf-8-sig") as csv_file:
        for line, row in enumerate(csv.DictReader(csv_file), start=2):
            slug = (row.get("Platform Slug") or "").strip().lower()
            if not slug:
                continue
            parsed: dict[str, Any] = {
                "platform_slug": slug,
                "platform_name": row["Platform"].strip(),
                "case_label": row["Case"].strip(),
                "height_mm": float(row["Height (mm)"]),
                "spine_mm": float(row["Spine (mm)"]),
                "case_top_mm": float(row["Case Top (mm)"]),
                "logo_band_height_pct": float(row["Logo Band Height (%)"]),
                "logo": (row.get("Logo") or "").strip().lower() or None,
            }
            for column, header in _COLOR_COLUMNS.items():
                color = row[header].strip().lower()
                if not _HEX.match(color):
                    raise ValueError(f"{path.name} line {line}: {header} {color!r} isn't #rrggbb")
                parsed[column] = color
            for column, header in _OPTIONAL_COLOR_COLUMNS.items():
                color = (row.get(header) or "").strip().lower() or None
                if color is not None and not _HEX.match(color):
                    raise ValueError(f"{path.name} line {line}: {header} {color!r} isn't #rrggbb")
                parsed[column] = color
            if parsed["height_mm"] <= 0 or parsed["spine_mm"] <= 0:
                raise ValueError(f"{path.name} line {line}: sizes must be above 0")
            if not 0 <= parsed["case_top_mm"] < parsed["height_mm"] / 4:
                raise ValueError(
                    f"{path.name} line {line}: Case Top (mm) must be 0 or more and under a quarter of the height"
                )
            if not 0 < parsed["logo_band_height_pct"] <= 50:
                raise ValueError(f"{path.name} line {line}: Logo Band Height (%) must be above 0 and at most 50")
            if parsed["logo"] is not None and not _LOGO_FILE.match(parsed["logo"]):
                raise ValueError(
                    f"{path.name} line {line}: Logo {parsed['logo']!r} isn't a .svg, .png or .webp file name"
                )
            rows.append(parsed)
    slugs = [row["platform_slug"] for row in rows]
    if len(slugs) != len(set(slugs)):
        raise ValueError(f"{path.name}: a platform slug is listed twice")
    return rows


def upsert(db: Session, row: dict[str, Any]) -> GameCase:
    """Adds a case, or rewrites an existing one's reference columns; `shown` is never touched."""
    case = db.scalars(select(GameCase).where(GameCase.platform_slug == row["platform_slug"])).first()
    if case is None:
        case = GameCase(**row, shown=True)
        db.add(case)
    else:
        for column, value in row.items():
            setattr(case, column, value)
    db.flush()
    return case


def bare_slug(slug: str | None) -> str | None:
    """IGDB adds "--N" to a reused slug ("ps4--1"); cases match on the slug without it."""
    return slug.split("--")[0].lower() if slug else None
