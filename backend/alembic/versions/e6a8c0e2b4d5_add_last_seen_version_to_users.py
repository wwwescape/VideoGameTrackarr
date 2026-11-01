"""add last_seen_version to users

Revision ID: e6a8c0e2b4d5
Revises: d4f6a8c0e2b3
Create Date: 2026-11-02 02:00:00.000000

What's New: the newest app version whose release notes the account has closed. Left null for
the existing account, so the first start after this upgrade shows this version's notes once.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6a8c0e2b4d5'
down_revision: Union[str, None] = 'd4f6a8c0e2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column(
                "last_seen_version",
                sa.String(length=32),
                nullable=True,
                comment="Newest app version whose What's New was closed; null = an install from before What's New",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("last_seen_version")
