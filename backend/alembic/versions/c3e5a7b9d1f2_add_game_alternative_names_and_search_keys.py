"""add game_alternative_names and search keys

Revision ID: c3e5a7b9d1f2
Revises: b8d0f2a4c6e9
Create Date: 2026-11-22 00:00:00.000000

Short-name search: "gta 6" finds Grand Theft Auto VI in your library, and "gtav" finds GTA V.

- game_alternative_names holds IGDB's alternative names per game (acronyms, other spellings,
  foreign titles). Empty after this migration: the "Fetch alternative names" job, or any
  resync, fills it from IGDB.
- games.search_key / game_alternative_names.search_key hold the name reduced to letters and
  digits (lowercased, accents dropped), so search ignores punctuation and spaces. The games
  column is backfilled here. The function below is a frozen copy of
  app/core/search_keys.search_key, so this revision never changes if that one does.
"""
import unicodedata
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3e5a7b9d1f2'
down_revision: Union[str, None] = 'b8d0f2a4c6e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _search_key(text: str | None) -> str:
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", text).casefold()
    return "".join(ch for ch in decomposed if ch.isalnum())


def upgrade() -> None:
    with op.batch_alter_table('games', schema=None) as batch_op:
        batch_op.add_column(sa.Column('search_key', sa.String(length=512), server_default='', nullable=False))

    bind = op.get_bind()
    games = sa.table(
        'games', sa.column('id', sa.Integer), sa.column('name', sa.String), sa.column('search_key', sa.String)
    )
    rows = bind.execute(sa.select(games.c.id, games.c.name)).fetchall()
    updates = [{"game_id": row.id, "key": _search_key(row.name)} for row in rows]
    if updates:
        bind.execute(
            games.update().where(games.c.id == sa.bindparam("game_id")).values(search_key=sa.bindparam("key")),
            updates,
        )

    op.create_table(
        'game_alternative_names',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=512), nullable=False),
        sa.Column('comment', sa.String(length=255), nullable=True),
        sa.Column('search_key', sa.String(length=512), nullable=False),
        sa.ForeignKeyConstraint(
            ['game_id'], ['games.id'], name=op.f('fk_game_alternative_names_game_id_games'), ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_game_alternative_names')),
    )
    op.create_index(op.f('ix_game_alternative_names_game_id'), 'game_alternative_names', ['game_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_game_alternative_names_game_id'), table_name='game_alternative_names')
    op.drop_table('game_alternative_names')
    with op.batch_alter_table('games', schema=None) as batch_op:
        batch_op.drop_column('search_key')
