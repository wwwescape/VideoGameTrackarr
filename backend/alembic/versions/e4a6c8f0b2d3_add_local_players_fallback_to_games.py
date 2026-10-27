"""add local_players_fallback to games

Revision ID: e4a6c8f0b2d3
Revises: d1f3b5c7e9a2
Create Date: 2026-10-28 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4a6c8f0b2d3'
down_revision: Union[str, None] = 'd1f3b5c7e9a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('games', sa.Column('local_players_fallback', sa.Integer(), nullable=True))
    op.add_column('games', sa.Column('local_players_fallback_source', sa.String(length=20), nullable=True, comment='Where local_players_fallback came from: pcgamingwiki or steam'))


def downgrade() -> None:
    op.drop_column('games', 'local_players_fallback_source')
    op.drop_column('games', 'local_players_fallback')
