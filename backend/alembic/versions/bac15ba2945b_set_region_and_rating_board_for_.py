"""set region and rating board for playstation and steam library items

Revision ID: bac15ba2945b
Revises: a9193c457261
Create Date: 2026-06-25 07:14:49.285569

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bac15ba2945b'
down_revision: Union[str, None] = 'a9193c457261'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Matches by platform name / digital_storefront rather than hardcoded ids, so this still
# works regardless of which specific row ids a given environment ended up with.
def upgrade() -> None:
    bind = op.get_bind()

    pal_region_id = bind.execute(
        sa.text("SELECT id FROM regions WHERE name = 'PAL (Europe, UK, Australia, NZ, India)'")
    ).scalar()
    if pal_region_id is not None:
        bind.execute(
            sa.text(
                "UPDATE library_items SET region_id = :region_id, rating_board = 'pegi' "
                "WHERE platform_id IN (SELECT id FROM platforms WHERE name LIKE '%PlayStation%')"
            ),
            {"region_id": pal_region_id},
        )

    worldwide_region_id = bind.execute(sa.text("SELECT id FROM regions WHERE name = 'Worldwide'")).scalar()
    if worldwide_region_id is not None:
        bind.execute(
            sa.text(
                "UPDATE library_items SET region_id = :region_id, rating_board = NULL WHERE digital_storefront = 'Steam'"
            ),
            {"region_id": worldwide_region_id},
        )


def downgrade() -> None:
    # Lossy: the prior region/rating_board value per row isn't recorded anywhere, so this
    # can't be reconstructed.
    pass
