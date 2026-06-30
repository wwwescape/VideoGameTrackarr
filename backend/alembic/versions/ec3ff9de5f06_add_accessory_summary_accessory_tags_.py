"""add accessory summary, accessory tags, accessory notes

Revision ID: ec3ff9de5f06
Revises: c7890d31cfaf
Create Date: 2026-06-28 18:42:58.988432

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ec3ff9de5f06'
down_revision: Union[str, None] = 'c7890d31cfaf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Trimmed from autogenerate's raw output, which also picked up the same unrelated
    # pre-existing drift (hardware->device rename leftovers, library_items.format
    # column-type quirk) as every prior migration this session — only the new table/column
    # changes below belong here.
    op.create_table(
        'accessory_notes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('accessory_id', sa.Integer(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['accessory_id'], ['accessories.id'], name=op.f('fk_accessory_notes_accessory_id_accessories')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_accessory_notes')),
    )
    op.create_index(op.f('ix_accessory_notes_accessory_id'), 'accessory_notes', ['accessory_id'], unique=False)

    op.create_table(
        'accessory_tags',
        sa.Column('accessory_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['accessory_id'], ['accessories.id'], name=op.f('fk_accessory_tags_accessory_id_accessories')),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], name=op.f('fk_accessory_tags_tag_id_tags')),
        sa.PrimaryKeyConstraint('accessory_id', 'tag_id', name=op.f('pk_accessory_tags')),
    )

    op.add_column('accessories', sa.Column('summary', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('accessories', 'summary')

    op.drop_table('accessory_tags')

    op.drop_index(op.f('ix_accessory_notes_accessory_id'), table_name='accessory_notes')
    op.drop_table('accessory_notes')
