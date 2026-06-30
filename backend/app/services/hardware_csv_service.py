import csv
import io

from sqlalchemy.orm import Session

from app.repositories import user_accessory_repository, user_device_repository

# One row per owned/wishlisted unit, covering both Hardware and Accessory (distinguished
# by "type") — mirrors csv_service.py's games CSV, which similarly combines the catalog
# row and the library row into one flat format.
CSV_COLUMNS = [
    "type",
    "official_name",
    "manufacturer",
    "category",
    "platform",
    "model",
    "edition",
    "status",
    "condition",
    "purchase_price",
    "serial_number",
    "notes",
]


def export_hardware_csv(db: Session) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_COLUMNS)

    for item in user_device_repository.list_all_user_devices(db):
        device = item.device
        writer.writerow(
            [
                "hardware",
                device.official_name,
                device.manufacturer.name,
                device.device_type.name,
                device.hardware_platform.name if device.hardware_platform else "",
                device.model or "",
                "",
                item.status.value,
                item.condition.value if item.condition else "",
                item.purchase_price if item.purchase_price is not None else "",
                item.serial_number or "",
                item.notes or "",
            ]
        )

    for item in user_accessory_repository.list_all_user_accessories(db):
        accessory = item.accessory
        platform_names = ";".join(link.hardware_platform.name for link in accessory.compatible_platforms)
        writer.writerow(
            [
                "accessory",
                accessory.official_name,
                accessory.manufacturer.name,
                accessory.accessory_type.name,
                platform_names,
                accessory.model or "",
                accessory.edition or "",
                item.status.value,
                item.condition.value if item.condition else "",
                item.purchase_price if item.purchase_price is not None else "",
                item.serial_number or "",
                item.notes or "",
            ]
        )

    return output.getvalue()
