"""add display parent game id to games

Revision ID: aa18ee47be4e
Revises: 8316399b3ff7
Create Date: 2026-06-25 11:23:31.056030

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aa18ee47be4e'
down_revision: Union[str, None] = '8316399b3ff7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('games', schema=None) as batch_op:
        batch_op.add_column(sa.Column('display_parent_game_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            op.f('fk_games_display_parent_game_id_games'), 'games', ['display_parent_game_id'], ['id']
        )
        batch_op.create_index(
            op.f('ix_games_display_parent_game_id'), ['display_parent_game_id'], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table('games', schema=None) as batch_op:
        batch_op.drop_index(op.f('ix_games_display_parent_game_id'))
        batch_op.drop_constraint(op.f('fk_games_display_parent_game_id_games'), type_='foreignkey')
        batch_op.drop_column('display_parent_game_id')
