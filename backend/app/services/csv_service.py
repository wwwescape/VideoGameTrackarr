import csv
import io
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.catalog import Game, GameCategory
from app.models.library import LibraryItem, LibraryStatus, MediaFormat
from app.repositories import game_repository, library_item_repository, platform_repository, region_repository
from app.schemas.csv_import import CsvImportResult, CsvImportRowError

CSV_COLUMNS = ["name", "category", "status", "platform", "region", "format", "edition", "acquired_at", "notes"]


def export_csv(db: Session) -> str:
    items = library_item_repository.list_all_library_items(db)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_COLUMNS)
    for item in items:
        writer.writerow(
            [
                item.game.name,
                item.game.category.value if item.game.category else "",
                item.status.value,
                item.platform.name if item.platform else "",
                item.region.name if item.region else "",
                item.format.value if item.format else "",
                item.edition or "",
                item.acquired_at.isoformat() if item.acquired_at else "",
                item.notes or "",
            ]
        )
    return output.getvalue()


def _parse_enum(value: str, enum_cls, field: str, row_num: int):
    """Parse a case-insensitive enum value; blank means 'not provided' (None)."""
    text = value.strip()
    if not text:
        return None
    try:
        return enum_cls(text.lower())
    except ValueError as err:
        valid = ", ".join(e.value for e in enum_cls)
        raise ValueError(f"Row {row_num}: invalid {field} {text!r} (expected one of: {valid})") from err


def _parse_date(value: str, row_num: int):
    text = value.strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError as err:
        raise ValueError(f"Row {row_num}: invalid acquired_at {text!r} (expected YYYY-MM-DD)") from err


def _get_or_create_game(db: Session, name: str, category: GameCategory) -> Game:
    existing = db.scalar(select(Game).where(func.lower(Game.name) == name.lower()))
    if existing is not None:
        return existing
    return game_repository.create_manual_game(db, name=name, category=category)


def _library_item_exists(db: Session, game_id: int, platform_id: int | None, status: LibraryStatus) -> bool:
    stmt = select(LibraryItem.id).where(
        LibraryItem.game_id == game_id,
        LibraryItem.status == status,
    )
    stmt = stmt.where(
        LibraryItem.platform_id.is_(None) if platform_id is None else LibraryItem.platform_id == platform_id
    )
    return db.scalar(stmt) is not None


def import_csv(db: Session, csv_text: str) -> CsvImportResult:
    """Import library items from CSV text.

    Columns must be in CSV_COLUMNS order (the same order the CSV export uses, so an
    exported file re-imports cleanly). A header row with those exact names is optional
    and skipped when present. Rows are validated individually: a bad row is skipped with
    an error entry while the rest still import. Games are matched by name
    (case-insensitive) so re-importing never duplicates them, and neither does
    re-importing the same game + platform + status combination.
    """
    reader = csv.reader(io.StringIO(csv_text))
    rows = [row for row in reader if any(cell.strip() for cell in row)]

    start = 0
    if rows and [cell.strip().lower() for cell in rows[0]] == CSV_COLUMNS:
        start = 1

    imported = 0
    skipped = 0
    errors: list[CsvImportRowError] = []

    for index in range(start, len(rows)):
        row_num = index + 1  # 1-based, matching what the user sees in a spreadsheet
        cells = [(rows[index][i] if i < len(rows[index]) else "").strip() for i in range(len(CSV_COLUMNS))]
        # Positional to match CSV_COLUMNS order: name, category, status, platform,
        # region, format, edition, acquired_at, notes.
        name = cells[0]
        try:
            if not name:
                raise ValueError(f"Row {row_num}: name is required")
            category = _parse_enum(cells[1], GameCategory, "category", row_num) or GameCategory.MAIN_GAME
            status = _parse_enum(cells[2], LibraryStatus, "status", row_num) or LibraryStatus.OWNED
            media_format = _parse_enum(cells[5], MediaFormat, "format", row_num)
            acquired_at = _parse_date(cells[7], row_num)

            game = _get_or_create_game(db, name, category)
            platform_id = platform_repository.get_or_create_by_name(db, cells[3]).id if cells[3] else None
            region_id = region_repository.get_or_create_by_name(db, cells[4]).id if cells[4] else None

            if _library_item_exists(db, game.id, platform_id, status):
                skipped += 1
                continue

            library_item_repository.create_library_item(
                db,
                game_id=game.id,
                platform_id=platform_id,
                region_id=region_id,
                status=status,
                format=media_format,
                edition=cells[6] or None,
                acquired_at=acquired_at,
                notes=cells[8] or None,
            )
            imported += 1
        except ValueError as exc:
            skipped += 1
            errors.append(CsvImportRowError(row=row_num, message=str(exc)))

    db.commit()
    return CsvImportResult(imported=imported, skipped=skipped, errors=errors)
