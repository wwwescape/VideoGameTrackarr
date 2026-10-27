"""add igdb_import_entries

Revision ID: b5d7f9a1c3e6
Revises: a3c5e7f9b1d4
Create Date: 2026-10-27 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5d7f9a1c3e6'
down_revision: Union[str, None] = 'a3c5e7f9b1d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CATEGORIES = (
    'main_game', 'dlc_addon', 'expansion', 'bundle', 'standalone_expansion', 'mod', 'episode', 'season',
    'remake', 'remaster', 'expanded_game', 'port', 'fork', 'pack', 'update',
)


def upgrade() -> None:
    op.create_table(
        "igdb_import_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_id", sa.Integer(), nullable=False),
        sa.Column("match_igdb_id", sa.BigInteger(), nullable=True),
        sa.Column("match_name", sa.String(length=512), nullable=True),
        sa.Column("match_cover_url", sa.String(length=1024), nullable=True),
        sa.Column("match_first_release_date", sa.BigInteger(), nullable=True),
        sa.Column(
            "match_category",
            sa.Enum(*_CATEGORIES, name="gamecategory", native_enum=False, create_constraint=True),
            nullable=True,
        ),
        sa.Column("match_parent_igdb_id", sa.BigInteger(), nullable=True),
        sa.Column("exact_match_count", sa.Integer(), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dismissed", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("queued", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], name=op.f("fk_igdb_import_entries_game_id_games")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_igdb_import_entries")),
    )
    op.create_index(op.f("ix_igdb_import_entries_game_id"), "igdb_import_entries", ["game_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_igdb_import_entries_game_id"), table_name="igdb_import_entries")
    op.drop_table("igdb_import_entries")
