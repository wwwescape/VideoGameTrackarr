"""backfill igdb id onto legacy platforms and merge sync created dupes

Revision ID: 9125de60b575
Revises: f5e8f9b4b7e5
Create Date: 2026-06-24 09:05:32.647915

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9125de60b575'
down_revision: Union[str, None] = 'f5e8f9b4b7e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Companion to f5e8f9b4b7e5: app/repositories/platform_repository.py's get_or_create_by_igdb
# used to always insert a new row when no exact igdb_id match existed, even when a legacy
# row (igdb_id NULL, carried over from before this app tracked it) already represented the
# same hardware under IGDB's bare slug (IGDB sometimes appends a "--N" disambiguator, e.g.
# "ps4--1"). That created fresh duplicates on every game sync — this merges any such
# already-created duplicate back into its legacy counterpart and backfills the link, so the
# fixed repository function finds it directly via igdb_id next time.
def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, slug, igdb_id FROM platforms")).fetchall()

    by_slug = {slug: platform_id for platform_id, slug, _igdb_id in rows if slug}

    for synced_id, slug, igdb_id in rows:
        if igdb_id is None or not slug:
            continue
        bare_slug = slug.split("--")[0]
        legacy_id = by_slug.get(bare_slug)
        if legacy_id is None or legacy_id == synced_id:
            continue

        bind.execute(
            sa.text("UPDATE library_items SET platform_id = :legacy_id WHERE platform_id = :synced_id"),
            {"legacy_id": legacy_id, "synced_id": synced_id},
        )
        bind.execute(
            sa.text("UPDATE release_dates SET platform_id = :legacy_id WHERE platform_id = :synced_id"),
            {"legacy_id": legacy_id, "synced_id": synced_id},
        )
        # game_platforms has a composite (game_id, platform_id) primary key, so repointing
        # could collide with a row the game already has for the legacy platform — drop
        # those first, then repoint whatever's left.
        bind.execute(
            sa.text(
                "DELETE FROM game_platforms WHERE platform_id = :synced_id AND game_id IN "
                "(SELECT game_id FROM game_platforms WHERE platform_id = :legacy_id)"
            ),
            {"legacy_id": legacy_id, "synced_id": synced_id},
        )
        bind.execute(
            sa.text("UPDATE game_platforms SET platform_id = :legacy_id WHERE platform_id = :synced_id"),
            {"legacy_id": legacy_id, "synced_id": synced_id},
        )
        # The synced row must be gone before backfilling its igdb_id onto the legacy row —
        # igdb_id is unique, so both rows can't hold it at once.
        bind.execute(sa.text("DELETE FROM platforms WHERE id = :synced_id"), {"synced_id": synced_id})
        bind.execute(
            sa.text("UPDATE platforms SET igdb_id = :igdb_id WHERE id = :legacy_id"),
            {"igdb_id": igdb_id, "legacy_id": legacy_id},
        )


def downgrade() -> None:
    # Merging reassigns foreign keys and deletes rows; there's no record of which
    # library_items/game_platforms/release_dates rows pointed at which duplicate
    # beforehand, so this can't be reconstructed.
    pass
