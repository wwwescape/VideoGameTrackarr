"""unique constraint on collection and franchise slug

Revision ID: e76f110a82fa
Revises: fda7168df178
Create Date: 2026-06-29 19:12:47.009509

Only the collections.slug/franchises.slug uniqueness change is intentional here. Autogenerate
also picked up the same unrelated pre-existing schema drift earlier migrations this session
already chose not to clean up (stale ix_hardware_*/ix_user_hardware_*-named indexes/
constraints, a library_items.format column-type quirk) — discarded.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e76f110a82fa'
down_revision: Union[str, None] = 'fda7168df178'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('ix_collections_slug', table_name='collections')
    op.create_index(op.f('ix_collections_slug'), 'collections', ['slug'], unique=True)
    op.drop_index('ix_franchises_slug', table_name='franchises')
    op.create_index(op.f('ix_franchises_slug'), 'franchises', ['slug'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_franchises_slug'), table_name='franchises')
    op.create_index('ix_franchises_slug', 'franchises', ['slug'], unique=False)
    op.drop_index(op.f('ix_collections_slug'), table_name='collections')
    op.create_index('ix_collections_slug', 'collections', ['slug'], unique=False)
