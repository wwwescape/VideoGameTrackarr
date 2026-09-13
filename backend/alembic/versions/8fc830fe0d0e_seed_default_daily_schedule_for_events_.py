"""seed default daily schedule for events sync

Revision ID: 8fc830fe0d0e
Revises: 74b59382c914
Create Date: 2026-09-13 16:28:56.980274

Every other job in job_registry starts unscheduled (a `job_schedules` row is only created
lazily on first manual save, per JobSchedule's own docstring) — but Events is different from
every other sync job here: it's the only one where a user has no way to get any real content
onto a brand-new page without first knowing to go set a schedule themselves. Per explicit
product decision, `events_sync` gets a pre-seeded daily 3am schedule so the Events
page/Dashboard teaser has real data without a manual first step; a user can still change the
cadence or disable it entirely afterward via the normal Settings -> Jobs UI, same as every
other job. `INSERT OR IGNORE` keyed off the primary key (`job_id`), same idempotent-safe-to-
rerun approach as this repo's existing hardware-reference-entry seed migrations (e.g.
551f6e7555db) — a user who already customized this job's schedule before upgrading to this
migration keeps their own choice, never silently overwritten.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8fc830fe0d0e'
down_revision: Union[str, None] = '74b59382c914'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DEFAULT_CRON = "0 3 * * *"


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "INSERT OR IGNORE INTO job_schedules (job_id, enabled, cron_expression) "
            "VALUES ('events_sync', 1, :cron)"
        ),
        {"cron": _DEFAULT_CRON},
    )


def downgrade() -> None:
    # Not reversed — a user may have since customized this schedule; downgrading the schema
    # shouldn't silently discard their own choice. Matches this repo's existing seed-migration
    # precedent (e.g. 551f6e7555db) of leaving downgrade as a no-op for seeded rows.
    pass
