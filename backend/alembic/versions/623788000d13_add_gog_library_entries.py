"""add GOG library entries + GOG OAuth columns on users

The GOG Sync job caches the user's owned GOG products (from embed.gog.com's
getFilteredProducts) in gog_library_entries and matches them to IGDB games,
mirroring the Steam tables — owned-copy sync only, GOG exposes no playtime.
The GOG connect flow (Galaxy client OAuth) stores the rotating refresh token
on the user row, in plaintext: this codebase has no at-rest encryption for
stored secrets, so the token is only as safe as the database itself.

Revision ID: 623788000d13
Revises: d2f6a8c4e1b9
Create Date: 2026-11-12

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '623788000d13'
down_revision: str | None = 'd2f6a8c4e1b9'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "gog_library_entries",
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
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], name=op.f("fk_gog_library_entries_game_id_games")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_gog_library_entries")),
    )
    op.create_index(
        op.f("ix_gog_library_entries_game_id"), "gog_library_entries", ["game_id"], unique=False
    )
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
        sa.Column("total_size", sa.Integer(), server_default="0", nullable=False),
        sa.Column("downloaded_bytes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("status", sa.String(length=32), server_default="queued", nullable=False),
        sa.Column("error", sa.String(length=512), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], name=op.f("fk_gog_downloads_game_id_games")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_gog_downloads")),
        sa.UniqueConstraint("gog_product_id", "file_id", name="uq_gog_downloads_product_file"),
    )
    op.create_index(op.f("ix_gog_downloads_game_id"), "gog_downloads", ["game_id"], unique=False)
    op.add_column(
        'users',
        sa.Column(
            'gog_refresh_token',
            sa.String(length=255),
            nullable=True,
            comment="GOG Galaxy OAuth refresh token, saved on connect from the Integrations page",
        ),
    )
    op.add_column(
        'users',
        sa.Column(
            'gog_user_id',
            sa.String(length=64),
            nullable=True,
            comment="GOG account id from the OAuth token response",
        ),
    )
    op.add_column(
        'users',
        sa.Column(
            'gog_username',
            sa.String(length=64),
            nullable=True,
            comment="GOG username shown on the Integrations page",
        ),
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_gog_downloads_game_id"), table_name="gog_downloads")
    op.drop_table("gog_downloads")
    op.drop_column('users', 'gog_username')
    op.drop_column('users', 'gog_user_id')
    op.drop_column('users', 'gog_refresh_token')
    op.drop_index(op.f("ix_gog_library_entries_gog_product_id"), table_name="gog_library_entries")
    op.drop_index(op.f("ix_gog_library_entries_game_id"), table_name="gog_library_entries")
    op.drop_table("gog_library_entries")
