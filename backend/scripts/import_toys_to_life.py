"""Loads the curated Toys-to-Life datasets from docs/data/toys_to_life/*.csv (one file per
line, see app/services/toys_to_life_lines.py) into the toys_to_life_items table. New installs
get the same data from the seed migrations; this is for picking up later edits to a CSV.

Usage:
    python -m scripts.import_toys_to_life
    python -m scripts.import_toys_to_life --line lego-dimensions

Safe to re-run: rows are upserted by (line, set number), and only the catalog columns are
written — your ownership, rating, notes and tags stay as they are.
"""

import argparse
import csv
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import REPO_ROOT
from app.db.session import session_scope
from app.repositories import toys_to_life_repository
from app.services.toys_to_life_lines import LINES, ToysToLifeLine

DATA_DIR = REPO_ROOT / "docs" / "data" / "toys_to_life"


def _text(value: str | None) -> str | None:
    text = (value or "").strip()
    return text or None


def _int(value: str | None) -> int | None:
    text = _text(value)
    return int(text) if text else None


def parse_csv(path: Path) -> list[dict]:
    """One dict per pack, keyed by toys_to_life_items column (minus `line`)."""
    # utf-8-sig, same as the hardware import: copes with an Excel-saved BOM.
    with path.open(newline="", encoding="utf-8-sig") as csv_file:
        return [
            {
                "set_number": row["Set Number"].strip(),
                "name": row["Name"].strip(),
                "pack_type": row["Pack Type"].strip(),
                "franchise": _text(row["Franchise"]),
                "minifigures": _text(row["Minifigures"]),
                "platform_name": _text(row["Platform"]),
                "platform_igdb_id": _int(row["Platform IGDB ID"]),
                "release_date_na": _text(row["Release Date (North America)"]),
                "release_date_eu": _text(row["Release Date (Europe)"]),
                "release_date_ww": _text(row["Release Date (Worldwide)"]),
                "igdb_id": _int(row["IGDB ID"]),
                "igdb_url": _text(row["IGDB URL"]),
                "summary": _text(row["Summary"]),
            }
            for row in csv.DictReader(csv_file)
            if (row.get("Set Number") or "").strip()
        ]


def import_line(session: Session, line: ToysToLifeLine, directory: Path = DATA_DIR) -> int:
    rows = parse_csv(directory / line.csv_filename)
    for row in rows:
        toys_to_life_repository.upsert_item(session, line=line.slug, **row)
    print(f"{line.name}: upserted {len(rows)} row(s)")
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--line", choices=[line.slug for line in LINES], help="Only import this line")
    parser.add_argument("--path", default=str(DATA_DIR), help="Directory containing the source .csv files")
    args = parser.parse_args()

    with session_scope() as session:
        for line in LINES:
            if args.line in (None, line.slug):
                import_line(session, line, Path(args.path))


if __name__ == "__main__":
    main()
