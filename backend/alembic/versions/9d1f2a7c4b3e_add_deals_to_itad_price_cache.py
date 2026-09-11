"""add deals to itad price cache

Revision ID: 9d1f2a7c4b3e
Revises: 5c9c931a3e64
Create Date: 2026-09-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d1f2a7c4b3e'
down_revision: Union[str, None] = '5c9c931a3e64'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'itad_price_cache',
        sa.Column(
            'deals',
            sa.JSON(),
            nullable=True,
            comment="Every shop ITAD reported a current deal for as of the last refresh — "
            "each dict has shop_name/price_amount/price_currency/cut. current_* stays the "
            "cheapest of these (a coarse 'is anything on sale anywhere' filter); this is "
            "what lets a specific wishlist row match its own tracked storefront.",
        ),
    )


def downgrade() -> None:
    op.drop_column('itad_price_cache', 'deals')
