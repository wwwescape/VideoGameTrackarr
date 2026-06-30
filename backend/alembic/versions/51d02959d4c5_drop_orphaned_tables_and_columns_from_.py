"""drop orphaned tables and columns from repo audit

Revision ID: 51d02959d4c5
Revises: bb734f5a86d8
Create Date: 2026-06-30 09:49:36.064338

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision: str = '51d02959d4c5'
down_revision: Union[str, None] = 'bb734f5a86d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('saved_filters')
    op.drop_index('ix_sync_history_game_id', table_name='sync_history')
    op.drop_table('sync_history')
    op.drop_index('ix_hardware_editions_hardware_id', table_name='device_editions')
    op.drop_table('device_editions')
    op.drop_table('import_history')
    op.drop_column('games', 'aggregated_rating')
    op.drop_column('games', 'total_rating')
    op.drop_column('games', 'igdb_updated_at')


def downgrade() -> None:
    op.add_column('games', sa.Column('igdb_updated_at', sa.BIGINT(), nullable=True))
    op.add_column('games', sa.Column('total_rating', sa.FLOAT(), nullable=True))
    op.add_column('games', sa.Column('aggregated_rating', sa.FLOAT(), nullable=True))
    op.create_table('import_history',
    sa.Column('id', sa.INTEGER(), nullable=False),
    sa.Column('source', sa.VARCHAR(length=4), nullable=False),
    sa.Column('status', sa.VARCHAR(length=9), nullable=False),
    sa.Column('started_at', sa.DATETIME(), nullable=True),
    sa.Column('finished_at', sa.DATETIME(), nullable=True),
    sa.Column('records_processed', sa.INTEGER(), nullable=False),
    sa.Column('records_failed', sa.INTEGER(), nullable=False),
    sa.Column('error_log', sa.TEXT(), nullable=True),
    sa.CheckConstraint("source IN ('csv', 'json')", name='ck_import_history_importsource'),
    sa.CheckConstraint("status IN ('pending', 'running', 'succeeded', 'failed', 'partial')", name='ck_import_history_jobstatus'),
    sa.PrimaryKeyConstraint('id', name='pk_import_history')
    )
    op.create_table('device_editions',
    sa.Column('id', sa.INTEGER(), nullable=False),
    sa.Column('device_id', sa.INTEGER(), nullable=False),
    sa.Column('name', sa.VARCHAR(length=255), nullable=False),
    sa.Column('edition_type', sa.VARCHAR(length=8), nullable=False),
    sa.Column('release_date', sa.DATE(), nullable=True),
    sa.Column('region_id', sa.INTEGER(), nullable=True),
    sa.Column('artwork_url', sa.VARCHAR(length=1024), nullable=True),
    sa.Column('sku', sa.VARCHAR(length=100), nullable=True),
    sa.Column('barcode', sa.VARCHAR(length=100), nullable=True),
    sa.Column('created_at', sa.DATETIME(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updated_at', sa.DATETIME(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.CheckConstraint("edition_type IN ('standard', 'limited', 'special', 'bundle')", name='ck_hardware_editions_hardwareeditiontype'),
    sa.ForeignKeyConstraint(['device_id'], ['devices.id'], name='fk_hardware_editions_hardware_id_hardware'),
    sa.ForeignKeyConstraint(['region_id'], ['regions.id'], name='fk_hardware_editions_region_id_regions'),
    sa.PrimaryKeyConstraint('id', name='pk_hardware_editions')
    )
    op.create_index('ix_hardware_editions_hardware_id', 'device_editions', ['device_id'], unique=False)
    op.create_table('sync_history',
    sa.Column('id', sa.INTEGER(), nullable=False),
    sa.Column('trigger', sa.VARCHAR(length=9), nullable=False),
    sa.Column('scope', sa.VARCHAR(length=11), nullable=False),
    sa.Column('game_id', sa.INTEGER(), nullable=True),
    sa.Column('status', sa.VARCHAR(length=9), nullable=False),
    sa.Column('started_at', sa.DATETIME(), nullable=True),
    sa.Column('finished_at', sa.DATETIME(), nullable=True),
    sa.Column('error_message', sa.TEXT(), nullable=True),
    sa.CheckConstraint("scope IN ('full', 'incremental', 'single_game')", name='ck_sync_history_syncscope'),
    sa.CheckConstraint("status IN ('pending', 'running', 'succeeded', 'failed', 'partial')", name='ck_sync_history_jobstatus'),
    sa.CheckConstraint('"trigger" IN (\'manual\', \'automatic\')', name='ck_sync_history_synctrigger'),
    sa.ForeignKeyConstraint(['game_id'], ['games.id'], name='fk_sync_history_game_id_games'),
    sa.PrimaryKeyConstraint('id', name='pk_sync_history')
    )
    op.create_index('ix_sync_history_game_id', 'sync_history', ['game_id'], unique=False)
    op.create_table('saved_filters',
    sa.Column('id', sa.INTEGER(), nullable=False),
    sa.Column('name', sa.VARCHAR(length=255), nullable=False),
    sa.Column('filter_json', sqlite.JSON(), nullable=False),
    sa.Column('created_at', sa.DATETIME(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updated_at', sa.DATETIME(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.PrimaryKeyConstraint('id', name='pk_saved_filters')
    )
