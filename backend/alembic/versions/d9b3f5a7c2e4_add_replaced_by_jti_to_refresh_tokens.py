"""add replaced_by_jti to refresh_tokens

Revision ID: d9b3f5a7c2e4
Revises: c4a8e2f1d6b9
Create Date: 2026-10-26 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9b3f5a7c2e4'
down_revision: Union[str, None] = 'c4a8e2f1d6b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Set when a refresh token is rotated, so presenting it again can be told apart from a
    # logout/password-change revocation (see auth_service._detect_reuse).
    with op.batch_alter_table('refresh_tokens', schema=None) as batch_op:
        batch_op.add_column(sa.Column('replaced_by_jti', sa.String(length=36), nullable=True, comment='jti of the token this one was rotated into'))


def downgrade() -> None:
    with op.batch_alter_table('refresh_tokens', schema=None) as batch_op:
        batch_op.drop_column('replaced_by_jti')
