"""add overview_layout to users

Revision ID: e5c7a9b1d3f6
Revises: d9b3f5a7c2e4
Create Date: 2026-10-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5c7a9b1d3f6'
down_revision: Union[str, None] = 'd9b3f5a7c2e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Null until the Overview is customised: the frontend then uses its default layout.
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('overview_layout', sa.JSON(), nullable=True, comment='Overview page sections in display order, each {key, hidden}; null = the default layout'))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('overview_layout')
