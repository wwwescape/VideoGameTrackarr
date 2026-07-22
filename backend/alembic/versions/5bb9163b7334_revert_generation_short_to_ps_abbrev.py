"""revert generation_short back to PS2/3/4/5 abbreviations

Revision ID: 5bb9163b7334
Revises: 0ceee0952de3
Create Date: 2026-07-22 01:00:00.000000

0ceee0952de3 expanded "PS2".."PS5" to "PlayStation 2".."PlayStation 5" across
official_name/artefact/summary/generation_short together. That was correct for the first
three columns, but generation_short exists specifically to hold the abbreviated form (compare
"PlayStation"/"PS1", "PlayStation Portable"/"PSP", "PlayStation Vita"/"PS Vita", none of which
that migration touched) — collapsing it to equal `generation` verbatim defeated its purpose.
This reverts generation_short only, leaving the official_name/artefact/summary rename in place.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5bb9163b7334"
down_revision: Union[str, None] = "0ceee0952de3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_REVERTS = [
    ("PlayStation 2", "PS2"),
    ("PlayStation 3", "PS3"),
    ("PlayStation 4", "PS4"),
    ("PlayStation 5", "PS5"),
]


def upgrade() -> None:
    bind = op.get_bind()
    for old, new in _REVERTS:
        bind.execute(
            sa.text("UPDATE hardware_reference_entries SET generation_short = :new WHERE generation_short = :old"),
            {"old": old, "new": new},
        )


def downgrade() -> None:
    bind = op.get_bind()
    for old, new in _REVERTS:
        bind.execute(
            sa.text("UPDATE hardware_reference_entries SET generation_short = :old WHERE generation_short = :new"),
            {"old": old, "new": new},
        )
