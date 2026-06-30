import openpyxl

from app.models.hardware import HardwareReferenceEntry
from scripts.import_hardware_reference import import_from_directory, import_from_workbook

HEADER = [
    "Brand", "Family", "Generation", "Generation (Short)", "Artefact", "Official Name",
    "Category", "Type", "Release Date", "Discontinued", "Compatibility", "Summary",
]


def _build_workbook(tmp_path, filename, *, summary="A console."):
    workbook = openpyxl.Workbook()
    ws = workbook.active
    ws.title = "Master Hardware"
    ws.append(HEADER)
    ws.append(
        ["Sony", "PlayStation", "PlayStation 5", "PS5", "PlayStation 5", "Sony PlayStation 5",
         "Console", "Device", "2020-11-12", "No", "PlayStation 5", summary]
    )
    ws.append(
        ["Sony", "PlayStation", "PlayStation 5", "PS5", "DualSense", "Sony DualSense",
         "Controller", "Accessory", "2020", "No", "PlayStation 5", "A controller."]
    )
    path = tmp_path / filename
    workbook.save(path)
    return path


def test_import_from_workbook_creates_expected_rows(db_session, tmp_path):
    path = _build_workbook(tmp_path, "nintendo.xlsx")

    count = import_from_workbook(db_session, path)
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


def test_import_from_workbook_is_idempotent_on_rerun(db_session, tmp_path):
    path = _build_workbook(tmp_path, "nintendo.xlsx")
    import_from_workbook(db_session, path)
    db_session.commit()

    # Re-running against an updated spreadsheet (same official names, changed data) should
    # update in place, not create duplicates.
    path = _build_workbook(tmp_path, "nintendo.xlsx", summary="Updated summary.")
    import_from_workbook(db_session, path)
    db_session.commit()

    assert db_session.query(HardwareReferenceEntry).count() == 2
    console = (
        db_session.query(HardwareReferenceEntry).filter_by(official_name="Sony PlayStation 5").one()
    )
    assert console.summary == "Updated summary."


def test_import_from_directory_skips_excel_lock_files(db_session, tmp_path):
    _build_workbook(tmp_path, "nintendo.xlsx")
    (tmp_path / "~$nintendo.xlsx").write_text("not a real workbook")

    total = import_from_directory(db_session, tmp_path)
    db_session.commit()

    assert total == 2
