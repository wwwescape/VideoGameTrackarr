"""platform scoped game progress and play sessions

Revision ID: b82a0143a66f
Revises: d41922d67d60
Create Date: 2026-08-31 17:19:03.796394

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b82a0143a66f'
down_revision: Union[str, None] = 'd41922d67d60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# A game owned on multiple platforms previously shared one GameProgress/PlaySession row
# globally, so Steam Sync could silently overwrite a console copy's progress with PC data.
# Both tables are dropped and recreated platform-scoped rather than ALTERed in place —
# adding a NOT NULL platform_id column with no sensible default has no clean backfill (which
# platform would an existing row even belong to?), and the user has explicitly accepted
# losing existing Progress/Play Sessions data for this rework.


def upgrade() -> None:
    op.drop_index('ix_game_progress_game_id', table_name='game_progress')
    op.drop_table('game_progress')
    op.create_table(
        'game_progress',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=False),
        sa.Column('platform_id', sa.Integer(), nullable=False),
        sa.Column('play_status', sa.Enum('none', 'backlog', 'playing', 'completed', 'abandoned', name='playstatus', native_enum=False, create_constraint=True), nullable=False),
        sa.Column('playtime_minutes', sa.Integer(), nullable=False),
        sa.Column('rating', sa.Float(), nullable=True),
        sa.Column('review', sa.Text(), nullable=True),
        sa.Column('started_at', sa.Date(), nullable=True),
        sa.Column('completed_at', sa.Date(), nullable=True),
        sa.Column('last_played_at', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['game_id'], ['games.id'], name=op.f('fk_game_progress_game_id_games')),
        sa.ForeignKeyConstraint(['platform_id'], ['platforms.id'], name=op.f('fk_game_progress_platform_id_platforms')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_game_progress')),
        sa.UniqueConstraint('game_id', 'platform_id', name=op.f('uq_game_progress_game_id')),
    )
    op.create_index(op.f('ix_game_progress_game_id'), 'game_progress', ['game_id'], unique=False)

    op.drop_index('ix_play_sessions_game_id', table_name='play_sessions')
    op.drop_table('play_sessions')
    op.create_table(
        'play_sessions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=False),
        sa.Column('platform_id', sa.Integer(), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['game_id'], ['games.id'], name=op.f('fk_play_sessions_game_id_games')),
        sa.ForeignKeyConstraint(['platform_id'], ['platforms.id'], name=op.f('fk_play_sessions_platform_id_platforms')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_play_sessions')),
    )
    op.create_index(op.f('ix_play_sessions_game_id'), 'play_sessions', ['game_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_play_sessions_game_id'), table_name='play_sessions')
    op.drop_table('play_sessions')
    op.create_table(
        'play_sessions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['game_id'], ['games.id'], name=op.f('fk_play_sessions_game_id_games')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_play_sessions')),
    )
    op.create_index(op.f('ix_play_sessions_game_id'), 'play_sessions', ['game_id'], unique=False)

    op.drop_index(op.f('ix_game_progress_game_id'), table_name='game_progress')
    op.drop_table('game_progress')
    op.create_table(
        'game_progress',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=False),
        sa.Column('play_status', sa.Enum('none', 'backlog', 'playing', 'completed', 'abandoned', name='playstatus', native_enum=False, create_constraint=True), nullable=False),
        sa.Column('playtime_minutes', sa.Integer(), nullable=False),
        sa.Column('rating', sa.Float(), nullable=True),
        sa.Column('review', sa.Text(), nullable=True),
        sa.Column('started_at', sa.Date(), nullable=True),
        sa.Column('completed_at', sa.Date(), nullable=True),
        sa.Column('last_played_at', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['game_id'], ['games.id'], name=op.f('fk_game_progress_game_id_games')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_game_progress')),
    )
    op.create_index(op.f('ix_game_progress_game_id'), 'game_progress', ['game_id'], unique=True)
