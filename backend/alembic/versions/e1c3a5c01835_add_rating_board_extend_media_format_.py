"""add rating board, extend media format, update regions

Revision ID: e1c3a5c01835
Revises: cf60452f0c22
Create Date: 2026-06-24 20:09:46.658798

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1c3a5c01835'
down_revision: Union[str, None] = 'cf60452f0c22'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Renames keyed by the original seeded names (rather than hardcoded ids) so this also works
# on an environment whose regions table was seeded differently, or not at all.
_REGION_RENAMES = {
    "Japan and Asia (NTSC-J)": "NTSC-J (Japan)",
    "North America and South America (NTSC-U)": "NTSC-U/C (North America)",
    "Europe, New Zealand, Australia, Middle East, India, South Africa (PAL)": (
        "PAL (Europe, UK, Australia, NZ, India)"
    ),
    "China (NTSC-C)": "NTSC-C (China)",
}

_TARGET_REGIONS = [
    "NTSC-J (Japan)",
    "NTSC-U/C (North America)",
    "PAL (Europe, UK, Australia, NZ, India)",
    "NTSC-K (South Korea)",
    "NTSC-C (China)",
    "Region Free",
    "Worldwide",
    "Digital",
    "Unknown",
]


def upgrade() -> None:
    with op.batch_alter_table('library_items', schema=None) as batch_op:
        # drop_constraint re-applies the table's naming convention to whatever name is
        # passed (see e1dc0a572a1b's downgrade comment) — pass the bare enum name
        # ("mediaformat", as originally given to sa.Enum(name=...)), not the already-
        # qualified "ck_library_items_mediaformat", or it gets wrapped twice.
        batch_op.drop_constraint('mediaformat', type_='check')
        batch_op.create_check_constraint(
            op.f('ck_library_items_mediaformat'),
            "format IN ('physical', 'digital', 'iso', 'rom', 'abandonware', 'other')",
        )
        # SQLAlchemy's Enum(create_constraint=True) on a table that also has a naming-
        # convention "ck" template (see app/db/base.py) ends up emitting *two* CHECK
        # constraints for the same rule here — one named after the enum class itself
        # ("ratingboard"), one re-derived through the convention
        # ("ck_library_items_ratingboard") — the same gotcha documented in
        # dca1df83509e's downgrade. Harmless (both enforce the identical condition) and
        # not worth a second batch rebuild just to drop the redundant one.
        batch_op.add_column(
            sa.Column(
                'rating_board',
                sa.Enum(
                    'esrb', 'pegi', 'cero', 'usk', 'grac', 'classind', 'acb', 'iarc',
                    name='ratingboard', native_enum=False, create_constraint=True,
                ),
                nullable=True,
            )
        )

    bind = op.get_bind()
    for old_name, new_name in _REGION_RENAMES.items():
        bind.execute(sa.text("UPDATE regions SET name = :new_name WHERE name = :old_name"), {"new_name": new_name, "old_name": old_name})

    existing_names = {row[0] for row in bind.execute(sa.text("SELECT name FROM regions")).fetchall()}
    for name in _TARGET_REGIONS:
        if name not in existing_names:
            bind.execute(sa.text("INSERT INTO regions (name) VALUES (:name)"), {"name": name})


def downgrade() -> None:
    # The region renames/additions are a data correction, not reversible in general (other
    # library_items may already reference the newly added regions by the time this runs).
    with op.batch_alter_table('library_items', schema=None) as batch_op:
        batch_op.drop_column('rating_board')
        batch_op.drop_constraint(op.f('ck_library_items_mediaformat'), type_='check')
        batch_op.create_check_constraint(
            op.f('ck_library_items_mediaformat'), "format IN ('physical', 'digital', 'iso', 'rom')"
        )
