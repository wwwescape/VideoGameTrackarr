"""multiple ROMs per copy (label, no unique copy id) and BIOS files

Revision ID: f2a7c4e8b6d1
Revises: e1c5a9d3f7b2
Create Date: 2026-09-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2a7c4e8b6d1'
down_revision: Union[str, None] = 'e1c5a9d3f7b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('rom_files') as batch_op:
        batch_op.drop_constraint('uq_rom_files_library_item_id', type_='unique')
        batch_op.add_column(sa.Column('label', sa.String(length=100), nullable=True))
        batch_op.create_index(batch_op.f('ix_rom_files_library_item_id'), ['library_item_id'], unique=False)

    op.create_table(
        'bios_files',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('system', sa.String(length=32), nullable=False),
        sa.Column('filename', sa.String(length=100), nullable=False, comment='The exact name the core expects'),
        sa.Column('stored_filename', sa.String(length=64), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('md5', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_bios_files')),
        sa.UniqueConstraint('system', 'filename', name=op.f('uq_bios_files_system')),
    )
    op.create_index(op.f('ix_bios_files_system'), 'bios_files', ['system'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_bios_files_system'), table_name='bios_files')
    op.drop_table('bios_files')
    with op.batch_alter_table('rom_files') as batch_op:
        batch_op.drop_index(batch_op.f('ix_rom_files_library_item_id'))
        batch_op.drop_column('label')
        batch_op.create_unique_constraint('uq_rom_files_library_item_id', ['library_item_id'])
