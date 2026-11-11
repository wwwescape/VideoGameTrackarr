"""seed sony dualshock 3 hardware reference entry

Revision ID: c4e8a2d6f1b3
Revises: b7d3f1a9c5e2
Create Date: 2026-11-12 03:30:00.000000

The DualShock 3 (the PS3's rumble controller, 2007, which replaced the SIXAXIS) was missing
from the curated dataset in docs/data/hardware, so it never showed up in the Brand/Console/
Variant cascade on Add Accessory. Same `INSERT OR IGNORE` approach keyed off the unique
`official_name` index as bcf3318f6b13 (the PSX), so it's safe to re-run against a DB that
already has this row (e.g. one re-imported with scripts.import_hardware_reference).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import json as _json


# revision identifiers, used by Alembic.
revision: str = "c4e8a2d6f1b3"
down_revision: Union[str, None] = "b7d3f1a9c5e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_ENTRIES_JSON = r'''[{"brand":"Sony","family":"PlayStation","generation":"PlayStation 3","generation_short":"PS3","artefact":"DualShock 3 Wireless Controller","official_name":"Sony DualShock 3 Wireless Controller","category":"Controller","type":"Accessory","release_date":"2007","discontinued":1,"compatibility":"PlayStation 3","summary":"The DualShock 3 Wireless Controller is an official PlayStation controller designed to provide responsive and comfortable gameplay. It introduced features appropriate to its generation while maintaining compatibility with supported PlayStation hardware."}]'''


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
    # Not reversed — Accessory rows may already reference this entry by FK.
    pass
