"""add edition to games

Revision ID: 3b9b24fa36dd
Revises: 20054de2774f
Create Date: 2026-06-28 12:27:46.475977

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3b9b24fa36dd'
down_revision: Union[str, None] = '20054de2774f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Trimmed from autogenerate's raw output — same unrelated pre-existing drift (hardware->
    # device rename leftovers, library_items.format column-type quirk) as the price-column
    # migration before this one. Only the new column belongs here.
    op.add_column(
        'games',
        sa.Column(
            'edition',
            sa.String(length=255),
            nullable=True,
            comment="Free text, e.g. 'Game of the Year Edition' — only set for manually-added games",
        ),
    )


def downgrade() -> None:
    op.drop_column('games', 'edition')
