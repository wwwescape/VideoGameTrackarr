"""normalize hardware release dates to year only

Revision ID: 6ceaec16dba1
Revises: 2bd82d89962e
Create Date: 2026-06-28 20:31:18.161186

Only the release-date normalization is intentional here. Autogenerate also picked up
unrelated pre-existing schema drift (stale ix_hardware_*-named indexes/constraints left over
from an old "hardware->device" table rename, plus a library_items.format column-type quirk)
that earlier migrations already chose not to clean up — discarded, same as before.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6ceaec16dba1'
down_revision: Union[str, None] = '2bd82d89962e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # HardwareReferenceEntry.release_date is free text imported from data/hardware/*.xlsx and
    # historically mixed bare years ("1994") with full ISO dates ("1985-10-18") depending on
    # how the source spreadsheet cell was formatted. The importer now always normalizes to a
    # year going forward (see scripts/import_hardware_reference.py); this backfills existing
    # rows the same way. No-ops on rows already 4 characters or shorter.
    op.execute(
        "UPDATE hardware_reference_entries "
        "SET release_date = substr(release_date, 1, 4) "
        "WHERE release_date IS NOT NULL AND length(release_date) > 4"
    )

    # accessories.release_date: Date -> Integer (year only). SQLite can't alter a column's
    # type with a data transform in the same step, so this is add new column / backfill via
    # raw SQL / drop old column + rename, rather than a single alter_column.
    with op.batch_alter_table('accessories', schema=None) as batch_op:
        batch_op.add_column(sa.Column('release_date_year', sa.Integer(), nullable=True))

    op.execute(
        "UPDATE accessories "
        "SET release_date_year = CAST(strftime('%Y', release_date) AS INTEGER) "
        "WHERE release_date IS NOT NULL"
    )

    with op.batch_alter_table('accessories', schema=None) as batch_op:
        batch_op.drop_column('release_date')
        batch_op.alter_column('release_date_year', new_column_name='release_date')


def downgrade() -> None:
    with op.batch_alter_table('accessories', schema=None) as batch_op:
        batch_op.alter_column('release_date', new_column_name='release_date_year')

    with op.batch_alter_table('accessories', schema=None) as batch_op:
        batch_op.add_column(sa.Column('release_date', sa.Date(), nullable=True))

    # Lossy by design — only the year survives the forward migration, so downgrading can only
    # reconstruct Jan 1 of that year, not the original month/day.
    op.execute(
        "UPDATE accessories "
        "SET release_date = release_date_year || '-01-01' "
        "WHERE release_date_year IS NOT NULL"
    )

    with op.batch_alter_table('accessories', schema=None) as batch_op:
        batch_op.drop_column('release_date_year')

    # The HardwareReferenceEntry backfill above is one-directional (we no longer know which
    # rows originally had a full date) — not reversed on downgrade.
