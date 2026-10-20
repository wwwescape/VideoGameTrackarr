"""add hide_from_public to games

Revision ID: d9a1b3c5e7f2
Revises: b7e2c4f9a1d3
Create Date: 2026-10-20

Per-game flag for excluding a game from all public share pages.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9a1b3c5e7f2'
down_revision: Union[str, None] = 'b7e2c4f9a1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'games',
        sa.Column('hide_from_public', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('games', 'hide_from_public')
