"""add version_parent to games

Revision ID: d4f6b8c0e2a3
Revises: c2e4a6b8d0f1
Create Date: 2026-11-23 12:00:00.000000

An edition's base game on IGDB (its version_parent), so the add-on pickers can offer just the
editions of the same game (Forza Horizon 5, its Deluxe and Premium editions) without asking
IGDB each time. Imports and resyncs fill it; games already in the library start unchecked and
are filled in once, in batches, the first time a picker needs them.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4f6b8c0e2a3'
down_revision: Union[str, None] = 'c2e4a6b8d0f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('games') as batch_op:
        batch_op.add_column(sa.Column('version_parent_igdb_id', sa.BigInteger(), nullable=True))
        batch_op.add_column(
            sa.Column('version_parent_checked', sa.Boolean(), server_default=sa.false(), nullable=False)
        )
        batch_op.create_index('ix_games_version_parent_igdb_id', ['version_parent_igdb_id'])


def downgrade() -> None:
    with op.batch_alter_table('games') as batch_op:
        batch_op.drop_index('ix_games_version_parent_igdb_id')
        batch_op.drop_column('version_parent_checked')
        batch_op.drop_column('version_parent_igdb_id')
