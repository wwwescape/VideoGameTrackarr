"""delete cascade discovered phantom games with no library item

Revision ID: 551b31c9a576
Revises: 8de32f5b06d9
Create Date: 2026-06-25 14:54:54.740394

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '551b31c9a576'
down_revision: Union[str, None] = '8de32f5b06d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Repeated debugging of the addon-cascade import logic earlier in this project's history
# (see dfed43577fe2) ran full-library resyncs many times over, and each resync follows
# every owned game's IGDB parent_game backlinks to discover "children" regardless of
# category — pulling in siblings, editions, mods, bundles, etc. that were never something
# the user actually searched for or wanted to track. A game only ends up here if: it's
# top-level (parent_game_id IS NULL, so this never touches anything reachable via a real
# parent's Addons tab), it's IGDB-backed (igdb_id IS NOT NULL, so manually-created games are
# never touched), it has display_parent_game_id set (i.e. it was only ever discovered as a
# non-hierarchical child of some other local game, not a direct import target), and it has
# no library_item at all (never owned or wishlisted). Verified against the live database
# before writing this: none of these candidates are referenced as a parent by anything the
# user owns or wishlists, and none have notes/tags/progress/play sessions attached.
_CANDIDATE_IDS_SQL = """
    SELECT id FROM games
    WHERE parent_game_id IS NULL
    AND igdb_id IS NOT NULL
    AND display_parent_game_id IS NOT NULL
    AND id NOT IN (SELECT game_id FROM library_items)
"""

_DEPENDENT_TABLES = (
    "library_items",
    "game_progress",
    "play_sessions",
    "notes",
    "game_tags",
    "game_genres",
    "game_platforms",
    "game_companies",
    "game_franchises",
    "game_collections",
    "screenshots",
    "artworks",
    "game_videos",
    "release_dates",
)


def upgrade() -> None:
    bind = op.get_bind()
    for table in _DEPENDENT_TABLES:
        bind.execute(sa.text(f"DELETE FROM {table} WHERE game_id IN ({_CANDIDATE_IDS_SQL})"))
    bind.execute(sa.text(f"DELETE FROM games WHERE id IN ({_CANDIDATE_IDS_SQL})"))


def downgrade() -> None:
    # Not reversible — the deleted rows' catalog data is gone. Re-resyncing the local games
    # that originally discovered them as addons would re-create the ones still relevant.
    pass
