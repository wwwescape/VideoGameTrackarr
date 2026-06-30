"""accessory to accessory links and retire inventory popup fields

Revision ID: fda7168df178
Revises: 6ceaec16dba1
Create Date: 2026-06-28 23:19:21.132270

Only the new accessory_accessory_links table and the user_devices/user_accessories column
drops are intentional here. Autogenerate also picked up the same unrelated pre-existing
schema drift earlier migrations this session already chose not to clean up (stale
ix_hardware_*/ix_user_hardware_*-named indexes/constraints, a library_items.format
column-type quirk) — discarded.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fda7168df178'
down_revision: Union[str, None] = '6ceaec16dba1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'accessory_accessory_links',
        sa.Column('accessory_id', sa.Integer(), nullable=False),
        sa.Column('linked_accessory_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ['accessory_id'], ['accessories.id'],
            name=op.f('fk_accessory_accessory_links_accessory_id_accessories'),
        ),
        sa.ForeignKeyConstraint(
            ['linked_accessory_id'], ['accessories.id'],
            name=op.f('fk_accessory_accessory_links_linked_accessory_id_accessories'),
        ),
        sa.PrimaryKeyConstraint('accessory_id', 'linked_accessory_id', name=op.f('pk_accessory_accessory_links')),
    )

    op.drop_column('user_accessories', 'boxed')
    op.drop_column('user_accessories', 'complete_in_box')
    op.drop_column('user_accessories', 'purchase_date')
    op.drop_column('user_accessories', 'current_value')

    # device_edition_id is an indexed FK — SQLite needs batch mode for that, same pattern
    # as earlier migrations this session. The real on-disk index is still named
    # ix_user_hardware_hardware_edition_id (pre-rename, never cleaned up).
    with op.batch_alter_table('user_devices', schema=None) as batch_op:
        batch_op.drop_index('ix_user_hardware_hardware_edition_id')
        batch_op.drop_constraint('fk_user_hardware_hardware_edition_id_hardware_editions', type_='foreignkey')
        batch_op.drop_column('device_edition_id')
        batch_op.drop_column('boxed')
        batch_op.drop_column('complete_in_box')
        batch_op.drop_column('purchase_date')
        batch_op.drop_column('current_value')


def downgrade() -> None:
    with op.batch_alter_table('user_devices', schema=None) as batch_op:
        batch_op.add_column(sa.Column('current_value', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('purchase_date', sa.Date(), nullable=True))
        batch_op.add_column(sa.Column('complete_in_box', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('boxed', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('device_edition_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_user_hardware_hardware_edition_id_hardware_editions',
            'device_editions', ['device_edition_id'], ['id'],
        )
        batch_op.create_index('ix_user_hardware_hardware_edition_id', ['device_edition_id'])

    op.add_column('user_accessories', sa.Column('current_value', sa.Float(), nullable=True))
    op.add_column('user_accessories', sa.Column('purchase_date', sa.Date(), nullable=True))
    op.add_column('user_accessories', sa.Column('complete_in_box', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('user_accessories', sa.Column('boxed', sa.Boolean(), nullable=False, server_default=sa.false()))

    op.drop_table('accessory_accessory_links')
