"""add included to game_addon_links

Revision ID: c2e4a6b8d0f1
Revises: a8c0e2f4b6d9
Create Date: 2026-11-22 12:00:00.000000

An add-on can be marked Included in a game (e.g. Car Pass included in FH5 Premium): owning the
game then counts as owning the add-on. Existing links are plain "works with" links.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2e4a6b8d0f1'
down_revision: Union[str, None] = 'a8c0e2f4b6d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('game_addon_links') as batch_op:
        batch_op.add_column(sa.Column('included', sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('game_addon_links') as batch_op:
        batch_op.drop_column('included')
