"""add rating board to devices and accessories, revision to accessories

Revision ID: c0070ded3c4c
Revises: 3b9b24fa36dd
Create Date: 2026-06-28 13:20:14.408787

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c0070ded3c4c'
down_revision: Union[str, None] = '3b9b24fa36dd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_RATING_BOARD_ENUM = sa.Enum(
    'esrb', 'pegi', 'cero', 'usk', 'grac', 'classind', 'acb', 'iarc',
    name='ratingboard', native_enum=False, create_constraint=True,
)


def upgrade() -> None:
    # Trimmed from autogenerate's raw output, which also picked up the same unrelated
    # pre-existing drift (hardware->device rename leftovers, library_items.format
    # column-type quirk) as the last two migrations — only these three columns belong here.
    op.add_column('accessories', sa.Column('revision', sa.String(length=100), nullable=True))
    op.add_column('accessories', sa.Column('rating_board', _RATING_BOARD_ENUM, nullable=True))
    op.add_column('devices', sa.Column('rating_board', _RATING_BOARD_ENUM, nullable=True))


def downgrade() -> None:
    op.drop_column('devices', 'rating_board')
    op.drop_column('accessories', 'rating_board')
    op.drop_column('accessories', 'revision')
