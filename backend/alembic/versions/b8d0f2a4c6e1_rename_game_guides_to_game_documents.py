"""rename game_guides to game_documents

Revision ID: b8d0f2a4c6e1
Revises: a7c9e1f3b5d8
Create Date: 2026-11-25 12:00:00.000000

Manuals & Documents: Guides & Cheats' table becomes game_documents, with three more types
(manual, receipt, other), image uploads (jpg/png/webp) and an optional link to the library
copy a document is for (library_item_id). Widening an enum's CHECK constraint on SQLite
means rebuilding the table, so this creates game_documents, copies every row across with its
id (backups, signed links and the reader's remembered positions all go by id) and drops
game_guides. The files on disk don't move.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8d0f2a4c6e1'
down_revision: Union[str, None] = 'a7c9e1f3b5d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS = (
    "id, game_id, name, kind, platform_id, source, url, original_filename, stored_filename,"
    " rendered_filename, media_format, size_bytes, created_at, updated_at"
)
_SOURCE_CHECK = (
    "(source = 'link' AND url IS NOT NULL AND stored_filename IS NULL)"
    " OR (source = 'file' AND url IS NULL AND stored_filename IS NOT NULL)"
)


def _create(
    table: str,
    kinds: tuple[str, ...],
    formats: tuple[str, ...],
    source_enum: str,
    format_enum: str,
    with_copy: bool,
) -> None:
    copy_columns = (
        [
            sa.Column("library_item_id", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(
                ["library_item_id"], ["library_items.id"], name=op.f(f"fk_{table}_library_item_id_library_items")
            ),
        ]
        if with_copy
        else []
    )
    op.create_table(
        table,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "kind", sa.Enum(*kinds, name="guidekind", native_enum=False, create_constraint=True), nullable=False
        ),
        sa.Column("platform_id", sa.Integer(), nullable=True),
        sa.Column(
            "source",
            sa.Enum("file", "link", name=source_enum, native_enum=False, create_constraint=True),
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
            sa.Enum(*formats, name=format_enum, native_enum=False, create_constraint=True),
            nullable=True,
        ),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.CheckConstraint(_SOURCE_CHECK, name=op.f(f"ck_{table}_source")),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], name=op.f(f"fk_{table}_game_id_games")),
        sa.ForeignKeyConstraint(["platform_id"], ["platforms.id"], name=op.f(f"fk_{table}_platform_id_platforms")),
        sa.PrimaryKeyConstraint("id", name=op.f(f"pk_{table}")),
        *copy_columns,
    )
    op.create_index(op.f(f"ix_{table}_game_id"), table, ["game_id"])


def upgrade() -> None:
    _create(
        "game_documents",
        ("guide", "cheat", "manual", "receipt", "other"),
        ("pdf", "docx", "md", "txt", "jpg", "png", "webp"),
        "documentsource",
        "documentformat",
        with_copy=True,
    )
    op.execute(f"INSERT INTO game_documents ({_COLUMNS}) SELECT {_COLUMNS} FROM game_guides")
    op.drop_index(op.f("ix_game_guides_game_id"), table_name="game_guides")
    op.drop_table("game_guides")


def downgrade() -> None:
    # Manuals, receipts, other documents and images don't fit the old table, so they're
    # dropped (and copy links forgotten). Their files stay on disk in uploads/guides/.
    _create("game_guides", ("guide", "cheat"), ("pdf", "docx", "md", "txt"), "guidesource", "guideformat", False)
    op.execute(
        f"INSERT INTO game_guides ({_COLUMNS}) SELECT {_COLUMNS} FROM game_documents"
        " WHERE kind IN ('guide', 'cheat') AND (media_format IS NULL OR media_format IN ('pdf', 'docx', 'md', 'txt'))"
    )
    op.drop_index(op.f("ix_game_documents_game_id"), table_name="game_documents")
    op.drop_table("game_documents")
