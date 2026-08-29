"""add public share token to users

Revision ID: 0d5fd280fa87
Revises: 6e0eb5a68977
Create Date: 2026-08-29 00:30:51.281054

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0d5fd280fa87'
down_revision: Union[str, None] = '6e0eb5a68977'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite can't ALTER a table to add a constraint directly — batch mode does the
    # copy-and-move rebuild it needs (see bb734f5a86d8's precedent for the same pattern).
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('public_share_token', sa.String(length=64), nullable=True, comment='Unlisted share-link token for the public Games/Hardware view'))
        batch_op.create_unique_constraint(batch_op.f('uq_users_public_share_token'), ['public_share_token'])


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('uq_users_public_share_token'), type_='unique')
        batch_op.drop_column('public_share_token')
