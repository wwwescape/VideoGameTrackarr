"""add price to library items

Revision ID: 20054de2774f
Revises: 12e275bbbf5d
Create Date: 2026-06-28 11:49:47.999957

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20054de2774f'
down_revision: Union[str, None] = '12e275bbbf5d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Trimmed from autogenerate's raw output, which also picked up unrelated pre-existing
    # drift between the dev DB's index/constraint names and the current models (leftover
    # from the hardware->device rename) plus a library_items.format column-type quirk —
    # neither belongs in a migration about adding a price column.
    op.add_column('library_items', sa.Column('price', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('library_items', 'price')
