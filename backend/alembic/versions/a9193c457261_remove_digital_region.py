"""remove digital region

Revision ID: a9193c457261
Revises: e1c3a5c01835
Create Date: 2026-06-25 06:53:17.034557

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9193c457261'
down_revision: Union[str, None] = 'e1c3a5c01835'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# "Digital" doesn't describe a geography like the rest of the regions list (and overlaps
# confusingly with the unrelated Format=Digital field) — added in e1c3a5c01835, removed here
# on reconsideration. Only deletes it if nothing references it; leaves it alone otherwise
# rather than failing the migration or orphaning a library_item's region.
def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "DELETE FROM regions WHERE name = 'Digital' "
            "AND id NOT IN (SELECT region_id FROM library_items WHERE region_id IS NOT NULL)"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    existing = bind.execute(sa.text("SELECT 1 FROM regions WHERE name = 'Digital'")).first()
    if existing is None:
        bind.execute(sa.text("INSERT INTO regions (name) VALUES ('Digital')"))
