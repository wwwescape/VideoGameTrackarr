"""seed famicom hardware reference entry

Revision ID: 551f6e7555db
Revises: bcf3318f6b13
Create Date: 2026-08-08 21:13:53.944345

The Famicom (Nintendo's Japan-only original 8-bit console, the regional counterpart to the
NES) was missing from the curated dataset baked into 56b03c3c66b8 — added to
docs/data/hardware/Nintendo_Master_Hardware_Database.csv along with a curated product photo
at backend/static/hardware-reference/family-computer.jpg. Same `INSERT OR IGNORE` approach
keyed off the unique `official_name` index as 07b6adcc2380/bcf3318f6b13, so it's safe to
re-run against a DB that already has this row.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import json as _json


# revision identifiers, used by Alembic.
revision: str = '551f6e7555db'
down_revision: Union[str, None] = 'bcf3318f6b13'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_ENTRIES_JSON = r'''[{"brand":"Nintendo","family":"Nintendo","generation":"Famicom","generation_short":"Famicom","artefact":"Family Computer","official_name":"Family Computer","category":"Console","type":"Device","release_date":"1983","discontinued":1,"compatibility":"Famicom","summary":"The Family Computer, commonly known as the Famicom, is Nintendo's original 8-bit home video game console released in Japan. It is the Japanese counterpart to the Nintendo Entertainment System (NES) and uses its own regional cartridge format."}]'''


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
