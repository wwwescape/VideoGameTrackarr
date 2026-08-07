"""seed sony psx hardware reference entry

Revision ID: bcf3318f6b13
Revises: 7a2f4c9e1b6d
Create Date: 2026-08-07 23:20:16.683757

The PSX (Sony's Japan-only PS2-based DVR/console hybrid, 2003) was missing from the
curated dataset baked into 56b03c3c66b8 — a curated product photo already exists at
backend/static/hardware-reference/sony-psx.jpg, but with no matching
hardware_reference_entries row it never showed up in the Brand/Console/Variant cascade on
Add Device. Same `INSERT OR IGNORE` approach keyed off the unique `official_name` index as
07b6adcc2380, so it's safe to re-run against a DB that already has this row.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import json as _json


# revision identifiers, used by Alembic.
revision: str = "bcf3318f6b13"
down_revision: Union[str, None] = "7a2f4c9e1b6d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_ENTRIES_JSON = r'''[{"brand":"Sony","family":"PlayStation","generation":"PlayStation 2","generation_short":"PS2","artefact":"PSX","official_name":"Sony PSX","category":"Console","type":"Device","release_date":"2003","discontinued":1,"compatibility":"PlayStation 2","summary":"The PSX is an official Sony PlayStation console that formed part of the PlayStation family. It introduced new hardware capabilities and a library of exclusive and third-party games while remaining one of the defining systems of its generation."}]'''


def upgrade() -> None:
    bind = op.get_bind()
    entries = _json.loads(_ENTRIES_JSON)
    bind.execute(
        sa.text(
            "INSERT OR IGNORE INTO hardware_reference_entries "
            "(brand, family, generation, generation_short, artefact, official_name, "
            "category, type, release_date, discontinued, compatibility, summary) "
            "VALUES (:brand, :family, :generation, :generation_short, :artefact, :official_name, "
            ":category, :type, :release_date, :discontinued, :compatibility, :summary)"
        ),
        entries,
    )


def downgrade() -> None:
    # Not reversed — Device/Accessory rows may already reference this entry by FK.
    pass
