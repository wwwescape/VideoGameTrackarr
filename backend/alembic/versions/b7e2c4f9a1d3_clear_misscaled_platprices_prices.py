"""clear PlatPrices prices cached with the wrong scale or currency

Revision ID: b7e2c4f9a1d3
Revises: a3d9e5b7c1f4
Create Date: 2026-10-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b7e2c4f9a1d3'
down_revision: Union[str, None] = 'a3d9e5b7c1f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Before this release every PlatPrices price was divided by 100 and, when PlatPrices
    # sent no PriceCurrency, labelled USD. That was only ever right for the US store: a
    # zero-decimal region (India, Japan, …) showed Rs 3,599 as $35.99, and other regions
    # could show the wrong currency. Clear those prices (matches/ppid and Ignored are kept)
    # so the next PlatPrices refresh stores them correctly.
    op.execute(
        """
        UPDATE platprices_cache
        SET current_price_amount = NULL,
            current_price_currency = NULL,
            current_shop_name = NULL,
            current_cut = NULL,
            historical_low_amount = NULL,
            historical_low_currency = NULL,
            historical_low_shop_name = NULL,
            historical_low_at = NULL,
            region = NULL
        WHERE region IS NOT NULL AND region <> 'US'
        """
    )


def downgrade() -> None:
    # Nothing to restore: the cleared prices were wrong, and a refresh refills them.
    pass
