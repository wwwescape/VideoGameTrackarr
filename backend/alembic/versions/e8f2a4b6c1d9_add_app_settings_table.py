"""Add app_settings table for persistent app-wide settings

Revision ID: e8f2a4b6c1d9
Revises: d9a1b3c5e7f2
Create Date: 2026-10-20

Creates a simple key-value store for app-wide settings. First used by the
Display Mode settings (slide interval, media types, volume), which need
server-backed persistence so every client shows the same slideshow.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8f2a4b6c1d9'
down_revision: Union[str, None] = 'd9a1b3c5e7f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'app_settings',
        sa.Column('key', sa.String(64), primary_key=True),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('app_settings')
