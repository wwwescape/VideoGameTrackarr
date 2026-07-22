"""expand PS2/3/4/5 abbreviations to PlayStation N

Revision ID: 0ceee0952de3
Revises: d2e6c3f1d2be
Create Date: 2026-07-22 00:00:00.000000

Several curated PlayStation entries used the abbreviated "PS2"/"PS3"/"PS4"/"PS5" form (e.g.
"Sony PS4 Slim", "Sony PlayStation Media Remote (PS5)") while the base console rows already
spelled it out ("Sony PlayStation 4"). Standardizes on the full "PlayStation N" form across
`official_name`, `artefact`, `summary`, and `generation_short` for consistency — this also
changes the image filename these rows resolve to (see
app/services/hardware_reference_image_service.py), since that's derived from `official_name`
at read time rather than stored.

Every occurrence found in the data is a clean standalone token (confirmed by scanning for
"PS2".."PS5" bounded by non-alphanumeric characters on both sides before writing this), so a
plain substring replace is safe — nothing like "PS45" or "xPS4y" exists to accidentally mangle.
Checked for official_name collisions ahead of time too (e.g. a rename that would produce a
string already used by a different row) — none exist.

Also re-runs the same normalized-name backfill as d2e6c3f1d2be for devices/accessories still
missing `hardware_reference_entry_id`: renaming "Sony PS3 Super Slim" -> "Sony PlayStation 3
Super Slim" (and similarly for PS4 Slim) means existing catalog rows named with the full
"PlayStation 3/4" wording can now match unambiguously where they couldn't before.
"""
import re
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0ceee0952de3"
down_revision: Union[str, None] = "d2e6c3f1d2be"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_REPLACEMENTS = [
    ("PS5", "PlayStation 5"),
    ("PS4", "PlayStation 4"),
    ("PS3", "PlayStation 3"),
    ("PS2", "PlayStation 2"),
]
_COLUMNS = ["official_name", "artefact", "summary", "generation_short"]


def _normalize(name: str) -> str:
    name = name.replace("(", " ").replace(")", " ")
    name = re.sub(r"\s+Edition\b", "", name, flags=re.IGNORECASE)
    name = re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()
    return re.sub(r"\s+", " ", name)


def _backfill_links(bind, table: str, reference_type: str) -> None:
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
    for column in _COLUMNS:
        for old, new in _REPLACEMENTS:
            bind.execute(
                sa.text(
                    f"UPDATE hardware_reference_entries SET {column} = REPLACE({column}, :old, :new) "
                    f"WHERE {column} LIKE :pattern"
                ),
                {"old": old, "new": new, "pattern": f"%{old}%"},
            )
    _backfill_links(bind, "devices", "Device")
    _backfill_links(bind, "accessories", "Accessory")


def downgrade() -> None:
    # Not reversed — indistinguishable from rows that already spelled out "PlayStation N"
    # before this migration ran (e.g. "Sony PlayStation 4"), so blindly reversing would mangle
    # those too. Same reasoning as 56b03c3c66b8/d2e6c3f1d2be's downgrades.
    pass
