"""add events event_videos event_networks and event_games

Revision ID: 74b59382c914
Revises: 9d1f2a7c4b3e
Create Date: 2026-09-13 14:37:20.661540

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '74b59382c914'
down_revision: Union[str, None] = '9d1f2a7c4b3e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# NOTE: alembic autogenerate also picked up unrelated pre-existing drift on
# device_types/devices/user_devices/library_items.format (a known, already-tracked leftover
# from an earlier devices/user_devices rename migration — see TODOS.md) — deliberately
# stripped out of this migration so it only does what its name says.


def upgrade() -> None:
    op.create_table('events',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('igdb_id', sa.BigInteger(), nullable=False),
    sa.Column('name', sa.String(length=512), nullable=False),
    sa.Column('slug', sa.String(length=512), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('start_time', sa.BigInteger(), nullable=True, comment='unix timestamp, from IGDB'),
    sa.Column('end_time', sa.BigInteger(), nullable=True, comment='unix timestamp, from IGDB'),
    sa.Column('time_zone', sa.String(length=100), nullable=True, comment="IGDB's free-text timezone label"),
    sa.Column('live_stream_url', sa.String(length=1024), nullable=True),
    sa.Column('event_logo_url', sa.String(length=1024), nullable=True),
    sa.Column('igdb_created_at', sa.BigInteger(), nullable=True),
    sa.Column('igdb_updated_at', sa.BigInteger(), nullable=True),
    sa.Column('checksum', sa.String(length=64), nullable=True, comment="IGDB's own change-detection hash — stored for future use, not read yet"),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_events'))
    )
    op.create_index(op.f('ix_events_igdb_id'), 'events', ['igdb_id'], unique=True)
    op.create_index(op.f('ix_events_name'), 'events', ['name'], unique=False)
    op.create_index(op.f('ix_events_slug'), 'events', ['slug'], unique=True)
    op.create_table('event_games',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('event_id', sa.Integer(), nullable=False),
    sa.Column('igdb_game_id', sa.BigInteger(), nullable=False),
    sa.Column('game_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(length=512), nullable=True),
    sa.Column('cover_url', sa.String(length=1024), nullable=True),
    sa.ForeignKeyConstraint(['event_id'], ['events.id'], name=op.f('fk_event_games_event_id_events')),
    sa.ForeignKeyConstraint(['game_id'], ['games.id'], name=op.f('fk_event_games_game_id_games')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_event_games'))
    )
    op.create_index(op.f('ix_event_games_event_id'), 'event_games', ['event_id'], unique=False)
    op.create_index(op.f('ix_event_games_game_id'), 'event_games', ['game_id'], unique=False)
    op.create_index(op.f('ix_event_games_igdb_game_id'), 'event_games', ['igdb_game_id'], unique=False)
    op.create_table('event_networks',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('event_id', sa.Integer(), nullable=False),
    sa.Column('igdb_id', sa.BigInteger(), nullable=True),
    sa.Column('network_type', sa.String(length=100), nullable=True),
    sa.Column('url', sa.String(length=1024), nullable=False),
    sa.ForeignKeyConstraint(['event_id'], ['events.id'], name=op.f('fk_event_networks_event_id_events')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_event_networks')),
    sa.UniqueConstraint('igdb_id', name=op.f('uq_event_networks_igdb_id'))
    )
    op.create_index(op.f('ix_event_networks_event_id'), 'event_networks', ['event_id'], unique=False)
    op.create_table('event_videos',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('event_id', sa.Integer(), nullable=False),
    sa.Column('igdb_id', sa.BigInteger(), nullable=True),
    sa.Column('name', sa.String(length=255), nullable=True),
    sa.Column('video_id', sa.String(length=255), nullable=False, comment='YouTube video id'),
    sa.ForeignKeyConstraint(['event_id'], ['events.id'], name=op.f('fk_event_videos_event_id_events')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_event_videos')),
    sa.UniqueConstraint('igdb_id', name=op.f('uq_event_videos_igdb_id'))
    )
    op.create_index(op.f('ix_event_videos_event_id'), 'event_videos', ['event_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_event_videos_event_id'), table_name='event_videos')
    op.drop_table('event_videos')
    op.drop_index(op.f('ix_event_networks_event_id'), table_name='event_networks')
    op.drop_table('event_networks')
    op.drop_index(op.f('ix_event_games_igdb_game_id'), table_name='event_games')
    op.drop_index(op.f('ix_event_games_game_id'), table_name='event_games')
    op.drop_index(op.f('ix_event_games_event_id'), table_name='event_games')
    op.drop_table('event_games')
    op.drop_index(op.f('ix_events_slug'), table_name='events')
    op.drop_index(op.f('ix_events_name'), table_name='events')
    op.drop_index(op.f('ix_events_igdb_id'), table_name='events')
    op.drop_table('events')
