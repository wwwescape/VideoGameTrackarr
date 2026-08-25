import csv

from app.models.hardware import HardwareReferenceEntry
from scripts.import_hardware_reference import import_from_csv, import_from_directory

HEADER = [
    "Brand", "Family", "Generation", "Generation (Short)", "Artefact", "Official Name",
    "Category", "Type", "Release Date", "Discontinued", "Compatibility", "Summary",
]


def _build_csv(tmp_path, filename, *, summary="A console."):
    path = tmp_path / filename
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(HEADER)
        writer.writerow(
            ["Sony", "PlayStation", "PlayStation 5", "PS5", "PlayStation 5", "Sony PlayStation 5",
             "Console", "Device", "2020-11-12", "No", "PlayStation 5", summary]
        )
        writer.writerow(
            ["Sony", "PlayStation", "PlayStation 5", "PS5", "DualSense", "Sony DualSense",
             "Controller", "Accessory", "2020", "No", "PlayStation 5", "A controller."]
        )
    return path


def test_import_from_csv_creates_expected_rows(db_session, tmp_path):
    path = _build_csv(tmp_path, "sony.csv")

    count = import_from_csv(db_session, path)
    db_session.commit()

    assert count == 2
    [console, controller] = (
        db_session.query(HardwareReferenceEntry).order_by(HardwareReferenceEntry.official_name.desc()).all()
    )
    assert console.official_name == "Sony PlayStation 5"
    assert console.brand == "Sony"
    assert console.generation_short == "PS5"
    assert console.type == "Device"
    assert console.release_date == "2020"
    assert console.discontinued is False

    assert controller.official_name == "Sony DualSense"
    assert controller.type == "Accessory"
    assert controller.release_date == "2020"


def test_import_from_csv_is_idempotent_on_rerun(db_session, tmp_path):
    path = _build_csv(tmp_path, "sony.csv")
    import_from_csv(db_session, path)
    db_session.commit()

    # Re-running against an updated CSV (same official names, changed data) should update
    # in place, not create duplicates.
    path = _build_csv(tmp_path, "sony.csv", summary="Updated summary.")
    import_from_csv(db_session, path)
    db_session.commit()

    assert db_session.query(HardwareReferenceEntry).count() == 2
    console = (
        db_session.query(HardwareReferenceEntry).filter_by(official_name="Sony PlayStation 5").one()
    )
    assert console.summary == "Updated summary."


def test_import_from_directory_sums_all_csv_files(db_session, tmp_path):
    _build_csv(tmp_path, "sony.csv")

    total = import_from_directory(db_session, tmp_path)
    db_session.commit()

    assert total == 2
