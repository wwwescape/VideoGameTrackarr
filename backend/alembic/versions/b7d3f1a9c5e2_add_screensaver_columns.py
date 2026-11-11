"""add screensaver columns

Revision ID: b7d3f1a9c5e2
Revises: 890ae488ac83
Create Date: 2026-11-11 18:00:00.000000

The Screensaver lab's per-game opt-out (every existing game is in, as every new one is) and its
time per cover, kept with the other server-side preferences on users (null = the default).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d3f1a9c5e2'
down_revision: Union[str, None] = '890ae488ac83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'games',
        sa.Column(
            'screensaver_excluded',
            sa.Boolean(),
            # sa.false(), not 'false': SQLite would store the text 'false', which `= 0` never
            # matches, so every existing game would look opted out.
            server_default=sa.false(),
            nullable=False,
            comment=(
                "True to leave the game's cover out of the Screensaver lab's carousel. Every game "
                "is in by default; kept while the lab is off, so turning it back on restores it"
            ),
        ),
    )
    op.add_column(
        'users',
        sa.Column(
            'screensaver_interval_seconds',
            sa.Integer(),
            nullable=True,
            comment='Screensaver lab: seconds each cover is shown, 5-15; null = the default (8)',
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'screensaver_interval_seconds')
    op.drop_column('games', 'screensaver_excluded')
