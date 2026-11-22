"""add GOG wishlist entries

Revision ID: a8c0e2f4b6d9
Revises: f4b6d8a0c2e3
Create Date: 2026-11-22 00:00:00.000000

GOG Sync's wishlist rows, mirroring steam_wishlist_entries: one row per product on the
connected GOG account's wishlist, with its IGDB match and the user's ignore choice.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8c0e2f4b6d9'
down_revision: Union[str, None] = 'f4b6d8a0c2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gog_wishlist_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("gog_product_id", sa.Integer(), nullable=False),
        sa.Column("gog_name", sa.String(length=255), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=True),
        sa.Column("dismissed", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], name=op.f("fk_gog_wishlist_entries_game_id_games")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_gog_wishlist_entries")),
    )
    op.create_index(op.f("ix_gog_wishlist_entries_game_id"), "gog_wishlist_entries", ["game_id"], unique=False)
    op.create_index(
        op.f("ix_gog_wishlist_entries_gog_product_id"), "gog_wishlist_entries", ["gog_product_id"], unique=True
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_gog_wishlist_entries_gog_product_id"), table_name="gog_wishlist_entries")
    op.drop_index(op.f("ix_gog_wishlist_entries_game_id"), table_name="gog_wishlist_entries")
    op.drop_table("gog_wishlist_entries")
