"""add preorder_bonus to game_addon_links

Revision ID: e6a8c0d2f4b5
Revises: d4f6b8c0e2a3
Create Date: 2026-11-23 18:30:00.000000

An add-on can be marked a pre-order bonus for a game, a third relation next to works-with and
Included (never both Included and a bonus). A label only: it doesn't count as owned.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6a8c0d2f4b5'
down_revision: Union[str, None] = 'd4f6b8c0e2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('game_addon_links') as batch_op:
        batch_op.add_column(sa.Column('preorder_bonus', sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('game_addon_links') as batch_op:
        batch_op.drop_column('preorder_bonus')
