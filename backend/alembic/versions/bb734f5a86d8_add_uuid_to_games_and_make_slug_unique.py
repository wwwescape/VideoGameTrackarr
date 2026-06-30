"""add uuid to games and make slug unique

Revision ID: bb734f5a86d8
Revises: 2b68cb058f44
Create Date: 2026-06-29 21:56:17.735045

"""
import uuid as uuid_module
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bb734f5a86d8'
down_revision: Union[str, None] = '2b68cb058f44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite can't add a NOT NULL column with no default to a non-empty table, and `games`
    # already has existing rows — add nullable, backfill a fresh uuid per row, then tighten.
    with op.batch_alter_table('games', schema=None) as batch_op:
        batch_op.add_column(sa.Column('uuid', sa.String(length=36), nullable=True))

    games = sa.table('games', sa.column('id', sa.Integer), sa.column('uuid', sa.String(length=36)))
    connection = op.get_bind()
    game_ids = [row[0] for row in connection.execute(sa.select(games.c.id))]
    for game_id in game_ids:
        connection.execute(games.update().where(games.c.id == game_id).values(uuid=str(uuid_module.uuid4())))

    with op.batch_alter_table('games', schema=None) as batch_op:
        batch_op.alter_column('uuid', existing_type=sa.String(length=36), nullable=False)
        batch_op.create_unique_constraint(batch_op.f('uq_games_uuid'), ['uuid'])

    op.drop_index('ix_games_slug', table_name='games')
    op.create_index(op.f('ix_games_slug'), 'games', ['slug'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_games_slug'), table_name='games')
    op.create_index('ix_games_slug', 'games', ['slug'], unique=False)

    with op.batch_alter_table('games', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('uq_games_uuid'), type_='unique')
        batch_op.drop_column('uuid')
