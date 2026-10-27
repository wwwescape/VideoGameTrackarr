"""add linked_from_custom to games

Revision ID: a3c5e7f9b1d4
Revises: f7a1c3e5b9d2
Create Date: 2026-10-27 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3c5e7f9b1d4'
down_revision: Union[str, None] = 'f7a1c3e5b9d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # False for every existing game: nothing recorded which linked games started out custom.
    with op.batch_alter_table('games', schema=None) as batch_op:
        batch_op.add_column(sa.Column('linked_from_custom', sa.Boolean(), server_default=sa.false(), nullable=False, comment='True for a game added by hand and later linked to IGDB; offers Change IGDB link and Unlink from IGDB'))


def downgrade() -> None:
    with op.batch_alter_table('games', schema=None) as batch_op:
        batch_op.drop_column('linked_from_custom')
