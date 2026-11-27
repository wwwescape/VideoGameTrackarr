"""add not_started, on_hold and endless play statuses

Revision ID: d3f5a7c9e1b4
Revises: b9d1f3a5c7e2
Create Date: 2026-11-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3f5a7c9e1b4'
down_revision: Union[str, None] = 'b9d1f3a5c7e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_OLD_VALUES = "'none', 'backlog', 'playing', 'completed', 'abandoned'"
_NEW_VALUES = "'none', 'not_started', 'backlog', 'playing', 'on_hold', 'endless', 'completed', 'abandoned'"


def upgrade() -> None:
    # No data moves: existing rows keep their status, and `none` (now labelled "Not set")
    # stays the empty value. The column widens from VARCHAR(9) because "not_started" is 11
    # characters — SQLite wouldn't care, Postgres would.
    with op.batch_alter_table('game_progress', schema=None) as batch_op:
        # drop_constraint re-applies the naming convention, so pass the bare enum name
        # (see e1c3a5c01835) — the live constraint is ck_game_progress_playstatus.
        batch_op.drop_constraint('playstatus', type_='check')
        batch_op.alter_column(
            'play_status',
            existing_type=sa.String(length=9),
            type_=sa.String(length=11),
            existing_nullable=False,
        )
        batch_op.create_check_constraint(
            op.f('ck_game_progress_playstatus'),
            f"play_status IN ({_NEW_VALUES})",
        )


def downgrade() -> None:
    # The new statuses have no older equivalent; fold them into the nearest old one so the
    # narrower CHECK constraint can be applied.
    op.execute("UPDATE game_progress SET play_status = 'backlog' WHERE play_status IN ('not_started', 'on_hold')")
    op.execute("UPDATE game_progress SET play_status = 'playing' WHERE play_status = 'endless'")
    with op.batch_alter_table('game_progress', schema=None) as batch_op:
        batch_op.drop_constraint('playstatus', type_='check')
        batch_op.alter_column(
            'play_status',
            existing_type=sa.String(length=11),
            type_=sa.String(length=9),
            existing_nullable=False,
        )
        batch_op.create_check_constraint(
            op.f('ck_game_progress_playstatus'),
            f"play_status IN ({_OLD_VALUES})",
        )
