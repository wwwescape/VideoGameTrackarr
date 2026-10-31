"""add store and CSV connectors

Revision ID: a1c3e5f7b9d0
Revises: f6b8d0a2c4e5
Create Date: 2026-10-28 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c3e5f7b9d0'
down_revision: Union[str, None] = 'f6b8d0a2c4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_KINDS = ('custom', 'nx_remote_launcher')
_NEW_KINDS = (*_OLD_KINDS, 'epic', 'gog', 'csv')


def upgrade() -> None:
    # SQLite can't alter a CHECK constraint in place: batch mode rebuilds the table.
    with op.batch_alter_table('connectors', schema=None) as batch_op:
        batch_op.add_column(sa.Column('credentials', sa.JSON(), nullable=True))
        batch_op.alter_column(
            'kind',
            existing_type=sa.Enum(*_OLD_KINDS, name='connectorkind', native_enum=False, create_constraint=True),
            type_=sa.Enum(*_NEW_KINDS, name='connectorkind', native_enum=False, create_constraint=True),
            existing_nullable=False,
        )


def downgrade() -> None:
    op.execute("DELETE FROM connectors WHERE kind IN ('epic', 'gog', 'csv')")
    with op.batch_alter_table('connectors', schema=None) as batch_op:
        batch_op.alter_column(
            'kind',
            existing_type=sa.Enum(*_NEW_KINDS, name='connectorkind', native_enum=False, create_constraint=True),
            type_=sa.Enum(*_OLD_KINDS, name='connectorkind', native_enum=False, create_constraint=True),
            existing_nullable=False,
        )
        batch_op.drop_column('credentials')
