import csv
import io

from sqlalchemy.orm import Session

from app.repositories import library_item_repository

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
