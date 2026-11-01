"""convert toys_to_life_ownership to toys_to_life_copies

Revision ID: f8b0d2e4a6c7
Revises: e6a8c0e2b4d5
Create Date: 2026-11-02 04:00:00.000000

Before release, c8e2a4f6b0d1 first created a one-status-per-pack `toys_to_life_ownership`
table and was later changed in place to create `toys_to_life_copies` (several copies per pack,
each with a price and notes). A database migrated in between still has the old table; this
turns each of its rows into a copy with the same status and drops it. On any other database
(the copies table already there, no old table) it does nothing.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8b0d2e4a6c7'
down_revision: Union[str, None] = 'e6a8c0e2b4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "toys_to_life_ownership" not in tables:
        return
    if "toys_to_life_copies" not in tables:
        op.create_table(
            "toys_to_life_copies",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("item_id", sa.Integer(), nullable=False),
            sa.Column(
                "status",
                sa.Enum("owned", "wishlist", name="librarystatus", native_enum=False, create_constraint=True),
                nullable=False,
            ),
            sa.Column("price", sa.Float(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
            sa.ForeignKeyConstraint(
                ["item_id"], ["toys_to_life_items.id"], name=op.f("fk_toys_to_life_copies_item_id_toys_to_life_items")
            ),
            sa.PrimaryKeyConstraint("id", name=op.f("pk_toys_to_life_copies")),
        )
        op.create_index(op.f("ix_toys_to_life_copies_item_id"), "toys_to_life_copies", ["item_id"])
        op.create_index(op.f("ix_toys_to_life_copies_status"), "toys_to_life_copies", ["status"])
    op.execute(
        "INSERT INTO toys_to_life_copies (item_id, status, created_at, updated_at) "
        "SELECT item_id, status, created_at, updated_at FROM toys_to_life_ownership ORDER BY id"
    )
    op.drop_index(op.f("ix_toys_to_life_ownership_status"), table_name="toys_to_life_ownership")
    op.drop_table("toys_to_life_ownership")


def downgrade() -> None:
    # The copies table is what c8e2a4f6b0d1 creates now; there's nothing to go back to.
    pass
