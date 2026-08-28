"""add text color to tags

Revision ID: 6e0eb5a68977
Revises: 10dd3aa5202e
Create Date: 2026-08-28 23:02:57.666142

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6e0eb5a68977'
down_revision: Union[str, None] = '10dd3aa5202e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tags', sa.Column('text_color', sa.String(length=20), nullable=True, comment="hex text color for UI chips"))


def downgrade() -> None:
    op.drop_column('tags', 'text_color')
