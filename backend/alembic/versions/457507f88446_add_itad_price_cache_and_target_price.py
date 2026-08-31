"""add itad price cache and target price

Revision ID: 457507f88446
Revises: 46bf45a133de
Create Date: 2026-08-30 19:24:09.767816

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '457507f88446'
down_revision: Union[str, None] = '46bf45a133de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "itad_price_cache",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False),
        sa.Column("itad_game_id", sa.String(length=64), nullable=True),
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
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], name=op.f("fk_itad_price_cache_game_id_games")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_itad_price_cache")),
        sa.UniqueConstraint("game_id", name=op.f("uq_itad_price_cache_game_id")),
    )

    # SQLite can't ALTER a table directly — batch mode does the copy-and-move rebuild it
    # needs (see 710fbc4d78b0's precedent for the same pattern).
    with op.batch_alter_table("library_items", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "target_price",
                sa.Float(),
                nullable=True,
                comment="Only meaningful when status=wishlist — flags this row 'on sale' once ITAD's current price drops to or below this",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("library_items", schema=None) as batch_op:
        batch_op.drop_column("target_price")

    op.drop_table("itad_price_cache")
