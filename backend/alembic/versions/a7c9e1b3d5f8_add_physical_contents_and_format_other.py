"""add physical_contents, media_count and format_other to library_items

Revision ID: a7c9e1b3d5f8
Revises: e5b9c3a7d1f4
Create Date: 2026-11-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c9e1b3d5f8'
down_revision: Union[str, None] = 'e5b9c3a7d1f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_PHYSICAL_CONTENTS_ENUM = sa.Enum(
    'disc', 'cartridge', 'floppy_disk', 'cassette', 'game_key_card', 'code_in_box',
    name='physicalcontents', native_enum=False, create_constraint=True,
)


def upgrade() -> None:
    # All nullable with no backfill — NULL contents means not set, and NULL format_other
    # falls back to the plain "Other" label.
    with op.batch_alter_table('library_items') as batch_op:
        batch_op.add_column(
            sa.Column(
                'physical_contents',
                _PHYSICAL_CONTENTS_ENUM,
                nullable=True,
                comment="Only meaningful when format=physical — NULL means not set",
            )
        )
        batch_op.add_column(
            sa.Column(
                'media_count',
                sa.Integer(),
                nullable=True,
                comment="How many discs, floppy disks or cassettes — only meaningful for those contents",
            )
        )
        batch_op.add_column(
            sa.Column(
                'format_other',
                sa.String(length=100),
                nullable=True,
                comment="Only meaningful when format=other — the user's own name for the format",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table('library_items') as batch_op:
        batch_op.drop_column('format_other')
        batch_op.drop_column('media_count')
        batch_op.drop_column('physical_contents')
