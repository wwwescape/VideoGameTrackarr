"""drop quantity from user_devices and user_accessories

Revision ID: 2b68cb058f44
Revises: e76f110a82fa
Create Date: 2026-06-29 20:46:50.460445

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2b68cb058f44'
down_revision: Union[str, None] = 'e76f110a82fa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('user_accessories', 'quantity')
    op.drop_column('user_devices', 'quantity')


def downgrade() -> None:
    op.add_column('user_devices', sa.Column('quantity', sa.INTEGER(), nullable=False, server_default='1'))
    op.add_column('user_accessories', sa.Column('quantity', sa.INTEGER(), nullable=False, server_default='1'))
