from app.schemas.base import CamelModel


class CsvImportRowError(CamelModel):
    row: int
    message: str


class CsvImportResult(CamelModel):
    imported: int
    skipped: int
    errors: list[CsvImportRowError] = []
