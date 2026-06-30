"""add external parent name and igdb url to games

Revision ID: 8316399b3ff7
Revises: bac15ba2945b
Create Date: 2026-06-25 10:41:18.952390

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8316399b3ff7'
down_revision: Union[str, None] = 'bac15ba2945b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('games', sa.Column('external_parent_name', sa.String(length=512), nullable=True))
    op.add_column('games', sa.Column('external_parent_igdb_url', sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column('games', 'external_parent_igdb_url')
    op.drop_column('games', 'external_parent_name')
