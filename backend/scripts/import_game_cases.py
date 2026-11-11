"""Loads the Game Shelf's predefined cases from docs/data/game_cases/Game_Cases.csv into the
game_cases table. New installs get the same data from the seed migration; this is for picking
up later edits to the CSV.

Usage:
    python -m scripts.import_game_cases

Safe to re-run: cases are upserted by platform slug, and only the reference columns are
written. Each case's Show on shelf choice stays as it is.
"""

import argparse
from pathlib import Path

from app.db.session import session_scope
from app.services import game_case_catalog


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", default=str(game_case_catalog.CSV_PATH), help="The .csv file to load")
    args = parser.parse_args()

    rows = game_case_catalog.parse_csv(Path(args.path))
    with session_scope() as session:
        for row in rows:
            game_case_catalog.upsert(session, row)
    print(f"Game cases: upserted {len(rows)} row(s)")


if __name__ == "__main__":
    main()
