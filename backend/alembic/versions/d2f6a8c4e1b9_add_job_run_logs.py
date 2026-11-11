"""add job run logs

Revision ID: d2f6a8c4e1b9
Revises: c4e8a2d6f1b3
Create Date: 2026-11-11 21:00:00.000000

One row per job run (Settings -> Jobs -> Logs): trigger, timing, outcome and captured log
lines, pruned to the newest few per job by the app itself.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2f6a8c4e1b9'
down_revision: Union[str, None] = 'c4e8a2d6f1b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'job_run_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('job_id', sa.String(length=100), nullable=False),
        sa.Column('trigger', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('result', sa.JSON(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('lines', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_job_run_logs_job_id_started_at', 'job_run_logs', ['job_id', 'started_at'])


def downgrade() -> None:
    op.drop_index('ix_job_run_logs_job_id_started_at', table_name='job_run_logs')
    op.drop_table('job_run_logs')
