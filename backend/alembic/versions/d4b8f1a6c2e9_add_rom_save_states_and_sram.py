"""add rom save states and in-game saves

Revision ID: d4b8f1a6c2e9
Revises: c7a2e4f9b1d3
Create Date: 2026-09-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4b8f1a6c2e9'
down_revision: Union[str, None] = 'c7a2e4f9b1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'rom_save_states',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('rom_file_id', sa.Integer(), nullable=False),
        sa.Column(
            'stored_filename',
            sa.String(length=64),
            nullable=False,
            comment='Relative to the ROM dir, uuid-based — never derived from user input',
        ),
        sa.Column('screenshot_filename', sa.String(length=64), nullable=True),
        sa.Column('screenshot_media_type', sa.String(length=32), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['rom_file_id'], ['rom_files.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_rom_save_states_rom_file_id'), 'rom_save_states', ['rom_file_id'], unique=False)
    with op.batch_alter_table('rom_files') as batch_op:
        batch_op.add_column(sa.Column('sram_stored_filename', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('sram_size_bytes', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('sram_updated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('rom_files') as batch_op:
        batch_op.drop_column('sram_updated_at')
        batch_op.drop_column('sram_size_bytes')
        batch_op.drop_column('sram_stored_filename')
    op.drop_index(op.f('ix_rom_save_states_rom_file_id'), table_name='rom_save_states')
    op.drop_table('rom_save_states')
