"""add game_guides

Revision ID: a7c9e1f3b5d8
Revises: e6a8c0d2f4b5
Create Date: 2026-11-24 12:00:00.000000

Guides & Cheats: guides and cheat sheets kept with a game, each an uploaded file (PDF, Word,
Markdown or text, stored privately under uploads/guides/) or a saved link.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c9e1f3b5d8'
down_revision: Union[str, None] = 'e6a8c0d2f4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "game_guides",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "kind",
            sa.Enum("guide", "cheat", name="guidekind", native_enum=False, create_constraint=True),
            nullable=False,
        ),
        sa.Column("platform_id", sa.Integer(), nullable=True),
        sa.Column(
            "source",
            sa.Enum("file", "link", name="guidesource", native_enum=False, create_constraint=True),
            nullable=False,
        ),
        sa.Column("url", sa.String(length=2048), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column(
            "stored_filename",
            sa.String(length=64),
            nullable=True,
            comment="uuid-based name on disk — never derived from user input",
        ),
        sa.Column(
            "rendered_filename",
            sa.String(length=64),
            nullable=True,
            comment="sanitised HTML (docx/md) or UTF-8 copy (non-UTF-8 txt), rebuilt on restore",
        ),
        sa.Column(
            "media_format",
            sa.Enum("pdf", "docx", "md", "txt", name="guideformat", native_enum=False, create_constraint=True),
            nullable=True,
        ),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.CheckConstraint(
            "(source = 'link' AND url IS NOT NULL AND stored_filename IS NULL)"
            " OR (source = 'file' AND url IS NULL AND stored_filename IS NOT NULL)",
            name=op.f("ck_game_guides_source"),
        ),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], name=op.f("fk_game_guides_game_id_games")),
        sa.ForeignKeyConstraint(["platform_id"], ["platforms.id"], name=op.f("fk_game_guides_platform_id_platforms")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_game_guides")),
    )
    op.create_index(op.f("ix_game_guides_game_id"), "game_guides", ["game_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_game_guides_game_id"), table_name="game_guides")
    op.drop_table("game_guides")
