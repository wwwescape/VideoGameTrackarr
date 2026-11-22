"""add game_addon_links

Revision ID: b8d0f2a4c6e9
Revises: a7c9e1b3d5f8
Create Date: 2026-11-22 00:00:00.000000

Manual "works with" links between an add-on and more games than its IGDB parent (e.g. an
FH5 car pack IGDB lists under the Standard edition only, linked to the Premium edition too).
A table of its own, so games.parent_game_id (IGDB's link) is never touched.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8d0f2a4c6e9'
down_revision: Union[str, None] = 'a7c9e1b3d5f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'game_addon_links',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('addon_game_id', sa.Integer(), nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(
            ['addon_game_id'], ['games.id'], name=op.f('fk_game_addon_links_addon_game_id_games'), ondelete='CASCADE'
        ),
        sa.ForeignKeyConstraint(
            ['game_id'], ['games.id'], name=op.f('fk_game_addon_links_game_id_games'), ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_game_addon_links')),
        sa.UniqueConstraint('addon_game_id', 'game_id', name=op.f('uq_game_addon_links_addon_game')),
    )
    op.create_index(op.f('ix_game_addon_links_addon_game_id'), 'game_addon_links', ['addon_game_id'])
    op.create_index(op.f('ix_game_addon_links_game_id'), 'game_addon_links', ['game_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_game_addon_links_game_id'), table_name='game_addon_links')
    op.drop_index(op.f('ix_game_addon_links_addon_game_id'), table_name='game_addon_links')
    op.drop_table('game_addon_links')
