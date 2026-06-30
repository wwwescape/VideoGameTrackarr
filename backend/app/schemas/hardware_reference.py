from app.models.hardware import HardwareReferenceEntry
from app.schemas.base import CamelModel


class HardwareReferenceEntryResponse(CamelModel):
    id: int
    brand: str
    family: str | None
    generation: str
    generation_short: str | None
    artefact: str
    official_name: str
    category: str
    type: str
    release_date: str | None
    discontinued: bool
    compatibility: str | None
    summary: str | None


def hardware_reference_entry_from_orm(entry: HardwareReferenceEntry) -> HardwareReferenceEntryResponse:
    return HardwareReferenceEntryResponse(
        id=entry.id,
        brand=entry.brand,
        family=entry.family,
        generation=entry.generation,
        generation_short=entry.generation_short,
        artefact=entry.artefact,
        official_name=entry.official_name,
        category=entry.category,
        type=entry.type,
        release_date=entry.release_date,
        discontinued=entry.discontinued,
        compatibility=entry.compatibility,
        summary=entry.summary,
    )


class HardwareReferenceSummary(CamelModel):
    """Nested "rich data" block on Device/Accessory detail responses — only the fields not
    already represented on the catalog row itself (brand/generation/official_name overlap
    with Device/Accessory's own manufacturer/hardwarePlatform/officialName)."""

    family: str | None
    artefact: str
    category: str
    release_date: str | None
    discontinued: bool
    compatibility: str | None
    summary: str | None


def hardware_reference_summary_from_orm(entry: HardwareReferenceEntry) -> HardwareReferenceSummary:
    return HardwareReferenceSummary(
        family=entry.family,
        artefact=entry.artefact,
        category=entry.category,
        release_date=entry.release_date,
        discontinued=entry.discontinued,
        compatibility=entry.compatibility,
        summary=entry.summary,
    )
