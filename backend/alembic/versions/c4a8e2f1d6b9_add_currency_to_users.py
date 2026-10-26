"""add currency to users

Revision ID: c4a8e2f1d6b9
Revises: b7e2c4f9a1d3
Create Date: 2026-10-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4a8e2f1d6b9'
down_revision: Union[str, None] = 'b7e2c4f9a1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Null until the user picks one (or the browser's earlier choice is copied up the first
    # time it signs in) — the frontend falls back to its default currency meanwhile.
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('currency', sa.String(length=3), nullable=True, comment='Display currency (ISO 4217 code), shared by every browser'))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('currency')
