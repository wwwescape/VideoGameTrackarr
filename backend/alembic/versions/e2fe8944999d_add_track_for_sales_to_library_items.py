"""add track_for_sales to library_items

Revision ID: e2fe8944999d
Revises: b82a0143a66f
Create Date: 2026-09-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2fe8944999d'
down_revision: Union[str, None] = 'b82a0143a66f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'library_items',
        sa.Column(
            'track_for_sales',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            comment="Opt-in: only rows with this set are ever matched against ITAD/PlatPrices",
        ),
    )
    # Backfill: a row that already has a target_price set was already opting into sale
    # tracking under the old always-on behavior — carry that intent forward so nobody's
    # active price watch silently goes dark. Everything else defaults to the new opt-out
    # baseline (False).
    op.execute("UPDATE library_items SET track_for_sales = 1 WHERE target_price IS NOT NULL")


def downgrade() -> None:
    op.drop_column('library_items', 'track_for_sales')
