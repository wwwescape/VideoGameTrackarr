"""remove redundant device and accessory columns

Revision ID: 2bd82d89962e
Revises: ec3ff9de5f06
Create Date: 2026-06-28 19:26:19.305885

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2bd82d89962e'
down_revision: Union[str, None] = 'ec3ff9de5f06'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Trimmed from autogenerate's raw output, which also picked up the same unrelated
    # pre-existing drift (hardware->device rename leftovers, library_items.format
    # column-type quirk) as every prior migration this session — only the column drops
    # below (plus one data cleanup statement) belong here. Batch mode is required on both
    # tables since region_id is an indexed FK column, same as the earlier
    # hardware_reference_entry_id FK addition.
    with op.batch_alter_table('devices', schema=None) as batch_op:
        batch_op.drop_constraint('fk_hardware_region_id_regions', type_='foreignkey')
        # Leftover from the pre-rename era (table was once "hardware") — never renamed to
        # ix_devices_region_id like its siblings, so batch mode's reflect-and-recreate
        # would otherwise try to rebuild it against the now-dropped column.
        batch_op.drop_index('ix_hardware_region_id')
        batch_op.drop_column('short_name')
        batch_op.drop_column('generation')
        batch_op.drop_column('release_date')
        batch_op.drop_column('discontinued_date')
        batch_op.drop_column('msrp')
        batch_op.drop_column('region_id')
        batch_op.drop_column('wireless')
        batch_op.drop_column('bluetooth')
        batch_op.drop_column('usb')
        batch_op.drop_column('notes')
        batch_op.drop_column('image_url')

    with op.batch_alter_table('accessories', schema=None) as batch_op:
        batch_op.drop_constraint('fk_accessories_region_id_regions', type_='foreignkey')
        batch_op.drop_column('short_name')
        batch_op.drop_column('discontinued_date')
        batch_op.drop_column('msrp')
        batch_op.drop_column('region_id')
        batch_op.drop_column('wireless')
        batch_op.drop_column('bluetooth')
        batch_op.drop_column('usb')
        batch_op.drop_column('notes')

    # Existing accessory image_url values predate the redesigned Add Accessory/Details
    # flows — predefined accessories never collect an image, so any value here is leftover
    # cruft from the old free-text edit dialog. Cleared unconditionally (confirmed with the
    # user); a custom accessory's own uploaded image can simply be re-uploaded.
    op.execute("UPDATE accessories SET image_url = NULL")


def downgrade() -> None:
    with op.batch_alter_table('accessories', schema=None) as batch_op:
        batch_op.add_column(sa.Column('notes', sa.TEXT(), nullable=True))
        batch_op.add_column(sa.Column('usb', sa.BOOLEAN(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('bluetooth', sa.BOOLEAN(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('wireless', sa.BOOLEAN(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('region_id', sa.INTEGER(), nullable=True))
        batch_op.add_column(sa.Column('msrp', sa.FLOAT(), nullable=True))
        batch_op.add_column(sa.Column('discontinued_date', sa.DATE(), nullable=True))
        batch_op.add_column(sa.Column('short_name', sa.VARCHAR(length=255), nullable=True))
        batch_op.create_foreign_key('fk_accessories_region_id_regions', 'regions', ['region_id'], ['id'])

    with op.batch_alter_table('devices', schema=None) as batch_op:
        batch_op.add_column(sa.Column('image_url', sa.VARCHAR(length=1024), nullable=True))
        batch_op.add_column(sa.Column('notes', sa.TEXT(), nullable=True))
        batch_op.add_column(sa.Column('usb', sa.BOOLEAN(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('bluetooth', sa.BOOLEAN(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('wireless', sa.BOOLEAN(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('region_id', sa.INTEGER(), nullable=True))
        batch_op.add_column(sa.Column('msrp', sa.FLOAT(), nullable=True))
        batch_op.add_column(sa.Column('discontinued_date', sa.DATE(), nullable=True))
        batch_op.add_column(sa.Column('release_date', sa.DATE(), nullable=True))
        batch_op.add_column(sa.Column('generation', sa.VARCHAR(length=50), nullable=True))
        batch_op.add_column(sa.Column('short_name', sa.VARCHAR(length=255), nullable=True))
        batch_op.create_foreign_key('fk_hardware_region_id_regions', 'regions', ['region_id'], ['id'])
        batch_op.create_index('ix_hardware_region_id', ['region_id'], unique=False)
