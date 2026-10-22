"""Bookshelf mode: platform spine template, case size, and spine styling

Revision ID: bk5h3lfplat1
Revises: b7e2c4f9a1d3
Create Date: 2026-10-22

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "bk5h3lfplat1"
down_revision: Union[str, None] = "b7e2c4f9a1d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("platforms", sa.Column("spine_template_url", sa.String(length=1024), nullable=True))
    op.add_column("platforms", sa.Column("case_height_mm", sa.Float(), nullable=True))
    op.add_column("platforms", sa.Column("case_spine_mm", sa.Float(), nullable=True))
    op.add_column("platforms", sa.Column("spine_color", sa.String(length=9), nullable=True))
    op.add_column("platforms", sa.Column("spine_icon", sa.String(length=32), nullable=True))
    op.add_column("platforms", sa.Column("spine_icon_url", sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column("platforms", "spine_icon_url")
    op.drop_column("platforms", "spine_icon")
    op.drop_column("platforms", "spine_color")
    op.drop_column("platforms", "case_spine_mm")
    op.drop_column("platforms", "case_height_mm")
    op.drop_column("platforms", "spine_template_url")
