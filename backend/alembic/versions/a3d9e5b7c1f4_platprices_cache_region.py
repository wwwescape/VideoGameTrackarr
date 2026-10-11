"""record which PS Store region each PlatPrices cached price came from

Revision ID: a3d9e5b7c1f4
Revises: f2a7c4e8b6d1
Create Date: 2026-10-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3d9e5b7c1f4'
down_revision: Union[str, None] = 'f2a7c4e8b6d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing rows stay null: their region is unknown, so the startup check clears their
    # prices once, and the next PlatPrices refresh fills them in for the configured region.
    with op.batch_alter_table('platprices_cache') as batch_op:
        batch_op.add_column(
            sa.Column(
                'region',
                sa.String(length=8),
                nullable=True,
                comment='PS Store region the cached prices were fetched for; null = before this was tracked',
            )
        )


def downgrade() -> None:
    with op.batch_alter_table('platprices_cache') as batch_op:
        batch_op.drop_column('region')
