"""Loads the curated hardware reference dataset from docs/data/hardware/*.csv (one master
hardware database per brand — Nintendo, Sega, Sony, Xbox) into the hardware_reference_entries
table. Powers the Brand/Console/Variant cascades on the Add Device/Add Accessory
(Predefined) forms and the "rich" reference data shown on the Device/Accessory detail
pages.

Usage:
    python -m scripts.import_hardware_reference
    python -m scripts.import_hardware_reference --path "../docs/data/hardware"

Safe to re-run: rows are upserted by `official_name` (globally unique across every source
file) — re-running after the source CSVs are updated just updates existing rows instead of
duplicating them.
"""

import argparse
import csv
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import REPO_ROOT
from app.db.session import session_scope
from app.repositories import hardware_reference_repository

DEFAULT_DIR = REPO_ROOT / "docs" / "data" / "hardware"


def _as_year_text(value: str | None) -> str | None:
    """Reduces a Release Date cell to just its 4-digit year — the source CSVs mix full ISO
    dates ("2020-11-12") with bare years ("1994"), but the app only ever needs the year."""
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    return text[:4] if text[:4].isdigit() else text


def import_from_csv(session: Session, path: Path) -> int:
    count = 0
    # utf-8-sig: the source CSVs are a mix of BOM-prefixed (Excel-exported) and plain
    # UTF-8 — utf-8-sig strips a leading BOM when present and is a no-op otherwise, so one
    # encoding handles both without corrupting the first header cell into "﻿Brand".
    with path.open(newline="", encoding="utf-8-sig") as csv_file:
        for row in csv.DictReader(csv_file):
            official_name = row["Official Name"]
            if not official_name:
                continue

            hardware_reference_repository.upsert(
                session,
                official_name=official_name,
                brand=row["Brand"],
                family=row["Family"] or None,
                generation=row["Generation"],
                generation_short=row["Generation (Short)"] or None,
                artefact=row["Artefact"],
                category=row["Category"],
                type=row["Type"],
                release_date=_as_year_text(row["Release Date"]),
                discontinued=row["Discontinued"].strip().lower() == "yes",
                compatibility=row["Compatibility"] or None,
                summary=row["Summary"] or None,
            )
            count += 1

    print(f"{path.name}: upserted {count} row(s)")
    return count


def import_from_directory(session: Session, directory: Path) -> int:
    total = 0
    for path in sorted(directory.glob("*.csv")):
        total += import_from_csv(session, path)
    print(f"Hardware reference entries: upserted {total} row(s) total")
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", default=str(DEFAULT_DIR), help="Directory containing the source .csv files")
    args = parser.parse_args()

    with session_scope() as session:
        import_from_directory(session, Path(args.path))


if __name__ == "__main__":
    main()
