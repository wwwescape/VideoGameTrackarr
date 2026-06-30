"""drop release_dates game platform region unique constraint

Revision ID: e1dc0a572a1b
Revises: 4ca7aaac1360
Create Date: 2026-06-22 18:32:31.423778

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1dc0a572a1b'
down_revision: Union[str, None] = '4ca7aaac1360'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Real IGDB data violates the assumption behind this constraint: a single game can have
# more than one release_dates row for the same (platform, release_region) pair (e.g. a
# "Definitive Edition" re-release shipping a second date under a different IGDB id for the
# same platform/region). release_dates has zero rows in every environment migrated so far,
# so dropping it is zero-risk; batch mode is still required since SQLite has no native
# ALTER TABLE ... DROP CONSTRAINT.
def upgrade() -> None:
    with op.batch_alter_table('release_dates', schema=None) as batch_op:
        batch_op.drop_constraint('uq_release_dates_game_id', type_='unique')


def downgrade() -> None:
    with op.batch_alter_table('release_dates', schema=None) as batch_op:
        batch_op.create_unique_constraint(
            op.f('uq_release_dates_game_id'), ['game_id', 'platform_id', 'release_region']
        )
