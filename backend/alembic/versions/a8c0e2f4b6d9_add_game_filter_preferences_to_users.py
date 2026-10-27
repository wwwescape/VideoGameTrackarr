"""add game filter preferences to users

Revision ID: a8c0e2f4b6d9
Revises: c4e6a8b0d2f7
Create Date: 2026-10-27 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8c0e2f4b6d9'
down_revision: Union[str, None] = 'c4e6a8b0d2f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Both null until first used: every Filter dialog field shown, no saved filters.
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('game_filter_fields', sa.JSON(), nullable=True, comment='Game list Filter dialog fields, each {key, hidden}; null = every field shown'))
        batch_op.add_column(sa.Column('saved_game_filters', sa.JSON(), nullable=True, comment="Named game list filters, each {name, filters}; filters is the frontend's own state"))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('saved_game_filters')
        batch_op.drop_column('game_filter_fields')
