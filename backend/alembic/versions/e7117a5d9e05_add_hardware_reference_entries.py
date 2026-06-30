"""add hardware reference entries

Revision ID: e7117a5d9e05
Revises: c0070ded3c4c
Create Date: 2026-06-28 14:41:14.160426

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7117a5d9e05'
down_revision: Union[str, None] = 'c0070ded3c4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Trimmed from autogenerate's raw output, which also picked up the same unrelated
    # pre-existing drift (hardware->device rename leftovers, library_items.format
    # column-type quirk) as every prior migration this session — only the new table and
    # its two FK columns belong here.
    op.create_table(
        'hardware_reference_entries',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('brand', sa.String(length=100), nullable=False),
        sa.Column('family', sa.String(length=100), nullable=True),
        sa.Column('generation', sa.String(length=100), nullable=False),
        sa.Column('generation_short', sa.String(length=50), nullable=True),
        sa.Column('artefact', sa.String(length=255), nullable=False),
        sa.Column('official_name', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('release_date', sa.String(length=20), nullable=True),
        sa.Column('discontinued', sa.Boolean(), nullable=False),
        sa.Column('compatibility', sa.String(length=255), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_hardware_reference_entries')),
    )
    op.create_index(op.f('ix_hardware_reference_entries_brand'), 'hardware_reference_entries', ['brand'], unique=False)
    op.create_index(op.f('ix_hardware_reference_entries_generation'), 'hardware_reference_entries', ['generation'], unique=False)
    op.create_index(op.f('ix_hardware_reference_entries_official_name'), 'hardware_reference_entries', ['official_name'], unique=True)
    op.create_index(op.f('ix_hardware_reference_entries_type'), 'hardware_reference_entries', ['type'], unique=False)

    with op.batch_alter_table('devices', schema=None) as batch_op:
        batch_op.add_column(sa.Column('hardware_reference_entry_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            op.f('fk_devices_hardware_reference_entry_id_hardware_reference_entries'),
            'hardware_reference_entries', ['hardware_reference_entry_id'], ['id'],
        )

    with op.batch_alter_table('accessories', schema=None) as batch_op:
        batch_op.add_column(sa.Column('hardware_reference_entry_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            op.f('fk_accessories_hardware_reference_entry_id_hardware_reference_entries'),
            'hardware_reference_entries', ['hardware_reference_entry_id'], ['id'],
        )


def downgrade() -> None:
    with op.batch_alter_table('accessories', schema=None) as batch_op:
        batch_op.drop_constraint(
            op.f('fk_accessories_hardware_reference_entry_id_hardware_reference_entries'), type_='foreignkey'
        )
        batch_op.drop_column('hardware_reference_entry_id')

    with op.batch_alter_table('devices', schema=None) as batch_op:
        batch_op.drop_constraint(
            op.f('fk_devices_hardware_reference_entry_id_hardware_reference_entries'), type_='foreignkey'
        )
        batch_op.drop_column('hardware_reference_entry_id')

    op.drop_index(op.f('ix_hardware_reference_entries_type'), table_name='hardware_reference_entries')
    op.drop_index(op.f('ix_hardware_reference_entries_official_name'), table_name='hardware_reference_entries')
    op.drop_index(op.f('ix_hardware_reference_entries_generation'), table_name='hardware_reference_entries')
    op.drop_index(op.f('ix_hardware_reference_entries_brand'), table_name='hardware_reference_entries')
    op.drop_table('hardware_reference_entries')
