"""add steelbook to library_items

Revision ID: b3f6d8a1c4e2
Revises: 4a1e7c9d2f6b
Create Date: 2026-09-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3f6d8a1c4e2'
down_revision: Union[str, None] = '4a1e7c9d2f6b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'library_items',
        sa.Column(
            'steelbook',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            comment="Only meaningful when format=physical — a Steelbook/metal-case copy vs. a standard case",
        ),
    )


def downgrade() -> None:
    op.drop_column('library_items', 'steelbook')
