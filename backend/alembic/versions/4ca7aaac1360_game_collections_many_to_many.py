"""game collections many to many

Revision ID: 4ca7aaac1360
Revises: dca1df83509e
Create Date: 2026-06-21 19:31:49.485403

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4ca7aaac1360'
down_revision: Union[str, None] = 'dca1df83509e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('game_collections',
    sa.Column('game_id', sa.Integer(), nullable=False),
    sa.Column('collection_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['collection_id'], ['collections.id'], name=op.f('fk_game_collections_collection_id_collections')),
    sa.ForeignKeyConstraint(['game_id'], ['games.id'], name=op.f('fk_game_collections_game_id_games')),
    sa.PrimaryKeyConstraint('game_id', 'collection_id', name=op.f('pk_game_collections'))
    )
    # SQLite has no ALTER TABLE ... DROP CONSTRAINT/DROP FOREIGN KEY — batch mode is
    # Alembic's copy-and-move workaround. games.collection_id has never been populated by
    # any code path, so there's no data migration concern.
    with op.batch_alter_table('games', schema=None) as batch_op:
        batch_op.drop_index('ix_games_collection_id')
        batch_op.drop_constraint('fk_games_collection_id_collections', type_='foreignkey')
        batch_op.drop_column('collection_id')


def downgrade() -> None:
    with op.batch_alter_table('games', schema=None) as batch_op:
        batch_op.add_column(sa.Column('collection_id', sa.INTEGER(), nullable=True))
        batch_op.create_foreign_key('fk_games_collection_id_collections', 'collections', ['collection_id'], ['id'])
        batch_op.create_index('ix_games_collection_id', ['collection_id'], unique=False)
    op.drop_table('game_collections')
