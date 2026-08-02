"""add job_schedules

Revision ID: 7a2f4c9e1b6d
Revises: 5bb9163b7334
Create Date: 2026-08-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7a2f4c9e1b6d"
down_revision: Union[str, None] = "5bb9163b7334"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "job_schedules",
        sa.Column("job_id", sa.String(length=100), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("cron_expression", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.PrimaryKeyConstraint("job_id", name=op.f("pk_job_schedules")),
    )


def downgrade() -> None:
    op.drop_table("job_schedules")
