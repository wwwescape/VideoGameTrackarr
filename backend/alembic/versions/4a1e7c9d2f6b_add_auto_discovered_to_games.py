"""add auto_discovered to games

Revision ID: 4a1e7c9d2f6b
Revises: 8fc830fe0d0e
Create Date: 2026-09-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4a1e7c9d2f6b'
down_revision: Union[str, None] = '8fc830fe0d0e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'games',
        sa.Column(
            'auto_discovered',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            comment=(
                "True only for games (and their cascade-imported addons) inserted by the "
                "Collection/Series 'what's missing' resync rather than a real add/import"
            ),
        ),
    )


def downgrade() -> None:
    op.drop_column('games', 'auto_discovered')
