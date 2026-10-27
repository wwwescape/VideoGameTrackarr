"""move rating to games and add igdb ratings

Revision ID: f7a1c3e5b9d2
Revises: e5c7a9b1d3f6
Create Date: 2026-10-27 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7a1c3e5b9d2'
down_revision: Union[str, None] = 'e5c7a9b1d3f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('games', schema=None) as batch_op:
        batch_op.add_column(sa.Column('user_rating', sa.Integer(), nullable=True, comment="Your overall rating, 1-10 stars; null = not rated"))
        batch_op.add_column(sa.Column('igdb_rating', sa.Float(), nullable=True, comment="IGDB members' average rating, 0-100 (IGDB's `rating`)"))
        batch_op.add_column(sa.Column('igdb_rating_count', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('igdb_critic_rating', sa.Float(), nullable=True, comment="Critics' average score, 0-100 (IGDB's `aggregated_rating`)"))
        batch_op.add_column(sa.Column('igdb_critic_rating_count', sa.Integer(), nullable=True))

    # The per-platform ratings become one rating per game: their average, rounded to whole
    # stars (they were already whole numbers 1-10 from the 5 half-star control).
    op.execute(
        """
        UPDATE games SET user_rating = (
            SELECT CAST(ROUND(AVG(game_progress.rating)) AS INTEGER) FROM game_progress
            WHERE game_progress.game_id = games.id AND game_progress.rating IS NOT NULL
        )
        """
    )
    op.execute("UPDATE games SET user_rating = NULL WHERE user_rating < 1")

    with op.batch_alter_table('game_progress', schema=None) as batch_op:
        batch_op.drop_column('rating')


def downgrade() -> None:
    with op.batch_alter_table('game_progress', schema=None) as batch_op:
        batch_op.add_column(sa.Column('rating', sa.Float(), nullable=True))
    # Each platform's progress gets the game's one rating back.
    op.execute(
        "UPDATE game_progress SET rating = (SELECT games.user_rating FROM games WHERE games.id = game_progress.game_id)"
    )

    with op.batch_alter_table('games', schema=None) as batch_op:
        batch_op.drop_column('igdb_critic_rating_count')
        batch_op.drop_column('igdb_critic_rating')
        batch_op.drop_column('igdb_rating_count')
        batch_op.drop_column('igdb_rating')
        batch_op.drop_column('user_rating')
