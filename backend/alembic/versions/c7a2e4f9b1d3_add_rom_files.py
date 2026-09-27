"""add rom_files

Revision ID: c7a2e4f9b1d3
Revises: b3f6d8a1c4e2
Create Date: 2026-09-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7a2e4f9b1d3'
down_revision: Union[str, None] = 'b3f6d8a1c4e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'rom_files',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('library_item_id', sa.Integer(), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column(
            'stored_filename',
            sa.String(length=64),
            nullable=False,
            comment='uuid-based name on disk — never derived from user input',
        ),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column(
            'extension',
            sa.String(length=16),
            nullable=False,
            comment="The playable file's extension — the upload's own, or the detected inner file's for a zip",
        ),
        sa.Column('is_archive', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['library_item_id'], ['library_items.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('library_item_id'),
    )


def downgrade() -> None:
    op.drop_table('rom_files')
