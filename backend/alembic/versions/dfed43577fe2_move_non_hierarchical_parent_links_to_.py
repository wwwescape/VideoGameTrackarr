"""move non hierarchical parent links to display parent

Revision ID: dfed43577fe2
Revises: aa18ee47be4e
Create Date: 2026-06-25 11:59:44.426891

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dfed43577fe2'
down_revision: Union[str, None] = 'aa18ee47be4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Leftover from an earlier import approach (relation arrays on the parent — dlcs/expansions/
# standalone_expansions/bundles/remakes/remasters/ports/forks — since reverted in favor of
# game_type-based classification) that set the structural parent_game_id for every
# discovered child regardless of category. Anything other than DLC/expansion/pack is
# independently ownable/playable and shouldn't be hidden from the main games list — see
# game_service.py's _HIERARCHICAL_ADDON_CATEGORIES, which is what every import/resync now
# enforces going forward. This is the one-time catch-up for what's already in the database
# (verified live: e.g. "Marvel's Spider-Man: Game of the Year Edition" has no parent_game
# backlink on IGDB at all, so a normal resync would never revisit and self-correct it).
def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "UPDATE games SET display_parent_game_id = parent_game_id, parent_game_id = NULL "
            "WHERE parent_game_id IS NOT NULL AND category NOT IN ('dlc_addon', 'expansion', 'pack')"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "UPDATE games SET parent_game_id = display_parent_game_id, display_parent_game_id = NULL "
            "WHERE display_parent_game_id IS NOT NULL AND category NOT IN ('dlc_addon', 'expansion', 'pack')"
        )
    )
