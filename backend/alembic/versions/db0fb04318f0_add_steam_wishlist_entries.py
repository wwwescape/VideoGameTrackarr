"""add steam wishlist entries

Revision ID: db0fb04318f0
Revises: 02bf259a654d
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'db0fb04318f0'
down_revision: Union[str, None] = '02bf259a654d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "steam_wishlist_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("steam_app_id", sa.Integer(), nullable=False),
        sa.Column("steam_name", sa.String(length=255), nullable=False),
        sa.Column("wishlist_added_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("game_id", sa.Integer(), nullable=True),
        sa.Column("dismissed", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], name=op.f("fk_steam_wishlist_entries_game_id_games")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_steam_wishlist_entries")),
    )
    op.create_index(
        op.f("ix_steam_wishlist_entries_game_id"), "steam_wishlist_entries", ["game_id"], unique=False
    )
    op.create_index(
        op.f("ix_steam_wishlist_entries_steam_app_id"), "steam_wishlist_entries", ["steam_app_id"], unique=True
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_steam_wishlist_entries_steam_app_id"), table_name="steam_wishlist_entries")
    op.drop_index(op.f("ix_steam_wishlist_entries_game_id"), table_name="steam_wishlist_entries")
    op.drop_table("steam_wishlist_entries")
