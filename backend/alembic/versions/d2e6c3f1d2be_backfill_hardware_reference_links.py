"""backfill device/accessory hardware reference links

Revision ID: d2e6c3f1d2be
Revises: 07b6adcc2380
Create Date: 2026-07-21 12:00:00.000000

Devices/Accessories only ever get `hardware_reference_entry_id` set at creation time, by
whichever Variant row the Add Device/Add Accessory cascade resolved (see
DevicePredefinedFields.tsx / AccessoryPredefinedFields.tsx). Anyone who added their catalog
before a given HardwareReferenceEntry existed — or whose row predates the reference table
entirely — has `hardware_reference_entry_id = NULL`, so they can never inherit that entry's
curated image (resolved at read time from official_name — see
app/services/hardware_reference_image_service.py) no matter how many curated images get added
later.

This is a one-time backfill: normalize both sides' official_name (strip parens, drop a
trailing "Edition", collapse punctuation/whitespace, lowercase) and link a Device/Accessory to
the single HardwareReferenceEntry of the matching type whose normalized name is identical.
Deliberately conservative — zero or multiple candidate matches are left NULL rather than
guessed, so this only ever links unambiguous matches (e.g. "Sony PlayStation 5 (Disc)" <->
"Sony PlayStation 5 Disc Edition"), never a wrong console/accessory.
"""
import re
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d2e6c3f1d2be"
down_revision: Union[str, None] = "07b6adcc2380"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _normalize(name: str) -> str:
    name = name.replace("(", " ").replace(")", " ")
    name = re.sub(r"\s+Edition\b", "", name, flags=re.IGNORECASE)
    name = re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()
    return re.sub(r"\s+", " ", name)


def _backfill(bind, table: str, reference_type: str) -> None:
    reference_rows = bind.execute(
        sa.text("SELECT id, official_name FROM hardware_reference_entries WHERE type = :type"),
        {"type": reference_type},
    ).fetchall()
    by_normalized_name: dict[str, list[int]] = {}
    for entry_id, official_name in reference_rows:
        by_normalized_name.setdefault(_normalize(official_name), []).append(entry_id)

    unlinked_rows = bind.execute(
        sa.text(f"SELECT id, official_name FROM {table} WHERE hardware_reference_entry_id IS NULL")
    ).fetchall()
    for row_id, official_name in unlinked_rows:
        candidates = by_normalized_name.get(_normalize(official_name), [])
        if len(candidates) == 1:
            bind.execute(
                sa.text(f"UPDATE {table} SET hardware_reference_entry_id = :ref_id WHERE id = :row_id"),
                {"ref_id": candidates[0], "row_id": row_id},
            )


def upgrade() -> None:
    bind = op.get_bind()
    _backfill(bind, "devices", "Device")
    _backfill(bind, "accessories", "Accessory")


def downgrade() -> None:
    # Not reversed — indistinguishable from links a user may have since set (or changed) by
    # hand via the existing "relink to a HardwareReferenceEntry" update path, same reasoning as
    # 56b03c3c66b8's downgrade.
    pass
