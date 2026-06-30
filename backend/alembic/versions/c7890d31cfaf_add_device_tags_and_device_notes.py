"""add device tags and device notes

Revision ID: c7890d31cfaf
Revises: e7117a5d9e05
Create Date: 2026-06-28 18:05:45.219997

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7890d31cfaf'
down_revision: Union[str, None] = 'e7117a5d9e05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Trimmed from autogenerate's raw output, which also picked up the same unrelated
    # pre-existing drift (hardware->device rename leftovers, library_items.format
    # column-type quirk) as every prior migration this session — only the two new tables
    # belong here.
    op.create_table(
        'device_notes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], name=op.f('fk_device_notes_device_id_devices')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_device_notes')),
    )
    op.create_index(op.f('ix_device_notes_device_id'), 'device_notes', ['device_id'], unique=False)

    op.create_table(
        'device_tags',
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], name=op.f('fk_device_tags_device_id_devices')),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], name=op.f('fk_device_tags_tag_id_tags')),
        sa.PrimaryKeyConstraint('device_id', 'tag_id', name=op.f('pk_device_tags')),
    )


def downgrade() -> None:
    op.drop_table('device_tags')

    op.drop_index(op.f('ix_device_notes_device_id'), table_name='device_notes')
    op.drop_table('device_notes')
