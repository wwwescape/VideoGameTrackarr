"""add steam library entries

Revision ID: 46bf45a133de
Revises: 710fbc4d78b0
Create Date: 2026-08-29 12:50:13.073003

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '46bf45a133de'
down_revision: Union[str, None] = '710fbc4d78b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "steam_library_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("steam_app_id", sa.Integer(), nullable=False),
        sa.Column("steam_name", sa.String(length=255), nullable=False),
        sa.Column("steam_playtime_minutes", sa.Integer(), nullable=False),
        sa.Column("steam_last_played_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("game_id", sa.Integer(), nullable=True),
        sa.Column("dismissed", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], name=op.f("fk_steam_library_entries_game_id_games")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_steam_library_entries")),
    )
    op.create_index(
        op.f("ix_steam_library_entries_game_id"), "steam_library_entries", ["game_id"], unique=False
    )
    op.create_index(
        op.f("ix_steam_library_entries_steam_app_id"), "steam_library_entries", ["steam_app_id"], unique=True
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_steam_library_entries_steam_app_id"), table_name="steam_library_entries")
    op.drop_index(op.f("ix_steam_library_entries_game_id"), table_name="steam_library_entries")
    op.drop_table("steam_library_entries")
