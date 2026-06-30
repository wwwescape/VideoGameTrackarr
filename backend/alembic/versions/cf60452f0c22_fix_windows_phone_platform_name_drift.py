"""fix windows phone platform name drift

Revision ID: cf60452f0c22
Revises: 9125de60b575
Create Date: 2026-06-24 17:12:44.159836

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cf60452f0c22'
down_revision: Union[str, None] = '9125de60b575'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# igdb_id=74 is IGDB's "Windows Phone" (slug "winphone") — this local row was carried over
# from before this app tracked igdb_id with the stale name "Windows Mobile", which made it
# look like a duplicate of the real "Windows Mobile" platform (igdb_id=405, a genuinely
# different OS). get_or_create_by_igdb deliberately never overwrites a name once a platform
# row exists (see platform_repository.py — protects deliberately curated names like "Sony
# PlayStation 4"), so this stale name needed a one-off correction instead of self-healing.
def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text("UPDATE platforms SET name = 'Windows Phone', abbreviation = 'Win Phone' WHERE igdb_id = 74")
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("UPDATE platforms SET name = 'Windows Mobile', abbreviation = NULL WHERE igdb_id = 74"))
