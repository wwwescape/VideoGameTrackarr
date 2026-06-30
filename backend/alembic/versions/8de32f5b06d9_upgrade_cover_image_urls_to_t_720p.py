"""upgrade cover image urls to t_720p

Revision ID: 8de32f5b06d9
Revises: dfed43577fe2
Create Date: 2026-06-25 13:08:51.392621

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8de32f5b06d9'
down_revision: Union[str, None] = 'dfed43577fe2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# t_cover_big (264x374) is small enough to look visibly soft once stretched into a detail
# page cover card or a wide grid tile column. _normalize_cover_url now requests t_720p
# instead, but that only takes effect on the next import/resync — this is the one-time
# catch-up so games already in the database get the sharper URL immediately rather than
# waiting for someone to resync each one individually.
def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("UPDATE games SET cover_url = REPLACE(cover_url, 't_cover_big', 't_720p') "
                          "WHERE cover_url LIKE '%t_cover_big%'"))


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("UPDATE games SET cover_url = REPLACE(cover_url, 't_720p', 't_cover_big') "
                          "WHERE cover_url LIKE '%t_720p%'"))
