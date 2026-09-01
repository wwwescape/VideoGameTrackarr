"""add ignored to itad and platprices cache

Revision ID: 58333deb2bb4
Revises: e2fe8944999d
Create Date: 2026-09-01 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '58333deb2bb4'
down_revision: Union[str, None] = 'e2fe8944999d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_IGNORED_COMMENT = (
    "Set once a title search comes back with no exact match — stops permanent re-search "
    "churn on every job run until Retry clears it"
)


def upgrade() -> None:
    op.add_column(
        'itad_price_cache',
        sa.Column('ignored', sa.Boolean(), nullable=False, server_default=sa.false(), comment=_IGNORED_COMMENT),
    )
    op.add_column(
        'platprices_cache',
        sa.Column('ignored', sa.Boolean(), nullable=False, server_default=sa.false(), comment=_IGNORED_COMMENT),
    )
    # Backfill: a row that was already attempted (checked_at is set) and still has no match
    # id today has already been silently re-searched on every job run since it first failed
    # — mark it ignored retroactively so the fix takes effect immediately, not just for
    # failures going forward.
    op.execute("UPDATE itad_price_cache SET ignored = 1 WHERE itad_game_id IS NULL AND checked_at IS NOT NULL")
    op.execute("UPDATE platprices_cache SET ignored = 1 WHERE ppid IS NULL AND checked_at IS NOT NULL")


def downgrade() -> None:
    op.drop_column('platprices_cache', 'ignored')
    op.drop_column('itad_price_cache', 'ignored')
