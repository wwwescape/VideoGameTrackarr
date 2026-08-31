"""add steam id 64 to users

Revision ID: 710fbc4d78b0
Revises: 0d5fd280fa87
Create Date: 2026-08-29 11:17:42.017327

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '710fbc4d78b0'
down_revision: Union[str, None] = '0d5fd280fa87'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite can't ALTER a table directly — batch mode does the copy-and-move rebuild it
    # needs (see 0d5fd280fa87's precedent for the same pattern). No unique constraint here,
    # unlike public_share_token — SteamID64 isn't a lookup key, just a stored preference.
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('steam_id_64', sa.String(length=32), nullable=True, comment='Steam profile SteamID64, used for Steam Web API sync'))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('steam_id_64')
