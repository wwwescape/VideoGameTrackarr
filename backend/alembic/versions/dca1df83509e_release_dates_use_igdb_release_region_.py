"""release dates use igdb release region enum

Revision ID: dca1df83509e
Revises: 275a2233c4a1
Create Date: 2026-06-21 16:59:16.769938

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dca1df83509e'
down_revision: Union[str, None] = '275a2233c4a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# SQLite has no ALTER TABLE ... DROP CONSTRAINT (or DROP FOREIGN KEY) — batch mode is
# Alembic's copy-and-move workaround (new table, copy rows, drop old, rename). release_dates
# has zero rows in every environment this has run in so far, so there's nothing to lose
# either way, but batch mode is correct regardless of row count.
def upgrade() -> None:
    with op.batch_alter_table('release_dates', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'release_region',
                sa.Enum(
                    'europe', 'north_america', 'australia', 'new_zealand', 'japan', 'china', 'asia', 'worldwide',
                    name='igdbreleaseregion', native_enum=False, create_constraint=True,
                ),
                nullable=True,
            )
        )
        batch_op.drop_constraint('uq_release_dates_game_id', type_='unique')
        batch_op.create_unique_constraint(
            op.f('uq_release_dates_game_id'), ['game_id', 'platform_id', 'release_region']
        )
        batch_op.drop_constraint('fk_release_dates_region_id_regions', type_='foreignkey')
        batch_op.drop_column('region_id')


def downgrade() -> None:
    # Not done via batch_alter_table: SQLAlchemy's Enum(create_constraint=True) on a table
    # that also has a naming-convention "ck" template (see app/db/base.py) ends up emitting
    # *two* CHECK constraints for the same rule — one named after the enum class itself,
    # one re-derived through the convention. Alembic's drop_constraint always re-applies the
    # naming convention to whatever name is passed, so only the convention-derived one is
    # ever reachable that way; the bare enum-named one has no way to be targeted by name and
    # permanently blocks dropping release_region in a reflected/batch rebuild. release_dates
    # has zero rows in every environment migrated so far, so a plain, explicit rebuild
    # (rather than relying on batch mode's reflection) sidesteps the issue entirely and is
    # just as safe.
    op.execute(
        """
        CREATE TABLE release_dates_downgrade_tmp (
            id INTEGER NOT NULL,
            game_id INTEGER NOT NULL,
            platform_id INTEGER,
            region_id INTEGER,
            igdb_id BIGINT,
            date BIGINT,
            human VARCHAR(100),
            CONSTRAINT pk_release_dates PRIMARY KEY (id),
            CONSTRAINT fk_release_dates_game_id_games FOREIGN KEY(game_id) REFERENCES games (id),
            CONSTRAINT fk_release_dates_platform_id_platforms FOREIGN KEY(platform_id) REFERENCES platforms (id),
            CONSTRAINT fk_release_dates_region_id_regions FOREIGN KEY(region_id) REFERENCES regions (id),
            CONSTRAINT uq_release_dates_game_id UNIQUE (game_id, platform_id, region_id),
            CONSTRAINT uq_release_dates_igdb_id UNIQUE (igdb_id)
        )
        """
    )
    op.execute(
        "INSERT INTO release_dates_downgrade_tmp (id, game_id, platform_id, igdb_id, date, human) "
        "SELECT id, game_id, platform_id, igdb_id, date, human FROM release_dates"
    )
    op.execute("DROP TABLE release_dates")
    op.execute("ALTER TABLE release_dates_downgrade_tmp RENAME TO release_dates")
