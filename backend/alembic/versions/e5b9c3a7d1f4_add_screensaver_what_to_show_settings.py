"""add screensaver what to show settings

Revision ID: e5b9c3a7d1f4
Revises: d2f6a8c4e1b9
Create Date: 2026-11-13 13:00:00.000000

Settings → Screensaver → What to show, kept on the account: games you own (on), wishlisted
games (off) and custom games (on). Existing accounts get today's behaviour (owned games,
custom ones included). sa.true()/sa.false(), not 'true'/'false': SQLite would store the text,
which a boolean comparison never matches.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e5b9c3a7d1f4"
down_revision: Union[str, None] = "d2f6a8c4e1b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "screensaver_show_owned",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
            comment="Screensaver shows games you own",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "screensaver_show_wishlist",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
            comment="Screensaver shows wishlisted games",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "screensaver_include_custom",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
            comment="Screensaver includes custom games (added by hand, no IGDB id)",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "screensaver_include_custom")
    op.drop_column("users", "screensaver_show_wishlist")
    op.drop_column("users", "screensaver_show_owned")
