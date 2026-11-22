"""add GOG Sync tables and GOG account columns

Revision ID: f4b6d8a0c2e3
Revises: c3e5a7b9d1f2
Create Date: 2026-11-22 00:00:00.000000

GOG Sync, the GOG counterpart of Steam Sync:

- gog_library_entries caches the owned GOG products and their IGDB match, mirroring
  steam_library_entries without playtime (GOG exposes none).
- gog_downloads is the queue of offline-installer files downloaded to the server. It is
  created here so the installer downloads need no migration of their own. Sizes are
  BigInteger: a single installer part can exceed 2 GB.
- users.gog_refresh_token / gog_user_id / gog_username hold the connected GOG account.
  The refresh token is stored as plain text, like every other stored secret here, and is
  never included in backups.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4b6d8a0c2e3'
down_revision: Union[str, None] = 'c3e5a7b9d1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gog_library_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("gog_product_id", sa.Integer(), nullable=False),
        sa.Column("gog_name", sa.String(length=255), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=True),
        sa.Column("dismissed", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], name=op.f("fk_gog_library_entries_game_id_games")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_gog_library_entries")),
    )
    op.create_index(op.f("ix_gog_library_entries_game_id"), "gog_library_entries", ["game_id"], unique=False)
    op.create_index(
        op.f("ix_gog_library_entries_gog_product_id"), "gog_library_entries", ["gog_product_id"], unique=True
    )

    op.create_table(
        "gog_downloads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False),
        sa.Column("gog_product_id", sa.Integer(), nullable=False),
        sa.Column("installer_id", sa.String(length=64), nullable=False),
        sa.Column("file_id", sa.String(length=64), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=True),
        sa.Column("total_size", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("downloaded_bytes", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("status", sa.String(length=32), server_default="queued", nullable=False),
        sa.Column("error", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], name=op.f("fk_gog_downloads_game_id_games")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_gog_downloads")),
        sa.UniqueConstraint("gog_product_id", "file_id", name="uq_gog_downloads_product_file"),
    )
    op.create_index("ix_gog_downloads_game_id", "gog_downloads", ["game_id"], unique=False)

    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column(
                "gog_refresh_token",
                sa.String(length=255),
                nullable=True,
                comment="GOG OAuth refresh token, saved when GOG is connected on the Integrations page",
            )
        )
        batch_op.add_column(
            sa.Column("gog_user_id", sa.String(length=64), nullable=True, comment="Connected GOG account id")
        )
        batch_op.add_column(
            sa.Column(
                "gog_username", sa.String(length=64), nullable=True, comment="Connected GOG account's username"
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("gog_username")
        batch_op.drop_column("gog_user_id")
        batch_op.drop_column("gog_refresh_token")
    op.drop_index("ix_gog_downloads_game_id", table_name="gog_downloads")
    op.drop_table("gog_downloads")
    op.drop_index(op.f("ix_gog_library_entries_gog_product_id"), table_name="gog_library_entries")
    op.drop_index(op.f("ix_gog_library_entries_game_id"), table_name="gog_library_entries")
    op.drop_table("gog_library_entries")
