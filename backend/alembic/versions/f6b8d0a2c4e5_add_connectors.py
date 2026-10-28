"""add connectors

Revision ID: f6b8d0a2c4e5
Revises: e4a6c8f0b2d3
Create Date: 2026-10-28 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6b8d0a2c4e5'
down_revision: Union[str, None] = 'e4a6c8f0b2d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        'connectors',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=60), nullable=False),
        sa.Column('kind', sa.Enum('custom', 'nx_remote_launcher', name='connectorkind', native_enum=False, create_constraint=True), nullable=False),
        sa.Column('platform_id', sa.Integer(), nullable=True),
        sa.Column('media_format', sa.String(length=8), nullable=True),
        sa.Column('digital_storefront', sa.String(length=100), nullable=True),
        sa.Column('wishlist', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('absent_mode', sa.Enum('keep', 'note', 'remove', name='connectorabsentmode', native_enum=False, create_constraint=True), nullable=False),
        sa.Column('last_sync_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_sync_result', sa.JSON(), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(['platform_id'], ['platforms.id']),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_connectors')),
    )
    op.create_index(op.f('ix_connectors_slug'), 'connectors', ['slug'], unique=True)
    op.create_table(
        'connector_devices',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('connector_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(['connector_id'], ['connectors.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash'),
    )
    op.create_index(op.f('ix_connector_devices_connector_id'), 'connector_devices', ['connector_id'])
    op.create_table(
        'connector_pairings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('connector_id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=9), nullable=False),
        sa.Column('poll_token_hash', sa.String(length=64), nullable=False),
        sa.Column('device_name', sa.String(length=100), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('device_token', sa.String(length=64), nullable=True),
        sa.Column('approved', sa.Boolean(), server_default=sa.false(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(['connector_id'], ['connectors.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
        sa.UniqueConstraint('poll_token_hash'),
    )
    op.create_index(op.f('ix_connector_pairings_connector_id'), 'connector_pairings', ['connector_id'])
    op.create_table(
        'connector_games',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('connector_id', sa.Integer(), nullable=False),
        sa.Column('external_id', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=512), nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=True),
        sa.Column('library_item_id', sa.Integer(), nullable=True),
        sa.Column('present', sa.Boolean(), server_default=sa.true(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(['connector_id'], ['connectors.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['game_id'], ['games.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['library_item_id'], ['library_items.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('connector_id', 'external_id', name='uq_connector_games_external_id'),
    )
    op.create_index(op.f('ix_connector_games_connector_id'), 'connector_games', ['connector_id'])
    op.create_index(op.f('ix_connector_games_game_id'), 'connector_games', ['game_id'])


def downgrade() -> None:
    op.drop_table('connector_games')
    op.drop_table('connector_pairings')
    op.drop_table('connector_devices')
    op.drop_index(op.f('ix_connectors_slug'), table_name='connectors')
    op.drop_table('connectors')
