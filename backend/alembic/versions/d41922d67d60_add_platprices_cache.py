"""add platprices cache

Revision ID: d41922d67d60
Revises: 457507f88446
Create Date: 2026-08-31 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd41922d67d60'
down_revision: Union[str, None] = '457507f88446'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "platprices_cache",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False),
        sa.Column("ppid", sa.String(length=64), nullable=True),
        sa.Column("current_price_amount", sa.Float(), nullable=True),
        sa.Column("current_price_currency", sa.String(length=8), nullable=True),
        sa.Column("current_shop_name", sa.String(length=100), nullable=True),
        sa.Column("current_cut", sa.Integer(), nullable=True),
        sa.Column("historical_low_amount", sa.Float(), nullable=True),
        sa.Column("historical_low_currency", sa.String(length=8), nullable=True),
        sa.Column("historical_low_shop_name", sa.String(length=100), nullable=True),
        sa.Column("historical_low_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], name=op.f("fk_platprices_cache_game_id_games")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_platprices_cache")),
        sa.UniqueConstraint("game_id", name=op.f("uq_platprices_cache_game_id")),
    )


def downgrade() -> None:
    op.drop_table("platprices_cache")
