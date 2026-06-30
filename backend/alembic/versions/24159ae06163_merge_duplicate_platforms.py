"""merge duplicate platforms

Revision ID: 24159ae06163
Revises: e1dc0a572a1b
Create Date: 2026-06-23 22:14:05.844023

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '24159ae06163'
down_revision: Union[str, None] = 'e1dc0a572a1b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Some environments have accumulated duplicate Platform rows for the same real platform
# (e.g. "PlayStation 4" and "Sony PlayStation 4") — legacy data that predates the
# igdb_id-keyed get_or_create_by_igdb lookup, so two rows exist with the same slug instead
# of one being updated in place. This merges each duplicate group into a single canonical
# row (the lowest id, which also happens to match IGDB's current canonical name in every
# group seen so far) and repoints every foreign key before dropping the duplicates.
def upgrade() -> None:
    bind = op.get_bind()
    platforms = bind.execute(sa.text("SELECT id, name, slug FROM platforms")).fetchall()

    groups: dict[str, list[int]] = {}
    for platform_id, _name, slug in platforms:
        if slug:
            groups.setdefault(slug, []).append(platform_id)

    duplicate_pairs: list[tuple[int, int]] = []
    for ids in groups.values():
        if len(ids) <= 1:
            continue
        canonical_id = min(ids)
        duplicate_pairs.extend((canonical_id, dup_id) for dup_id in ids if dup_id != canonical_id)

    # A handful of rows are IGDB's own self-flagged junk entries (e.g. name "DUPLICATE
    # Stadia", slug "duplicate-stadia") that don't share a slug with their real counterpart
    # verbatim, so the grouping above misses them — catch those by stripping the
    # "duplicate-" slug prefix and matching it against another platform's real slug.
    by_slug = {slug: platform_id for platform_id, _name, slug in platforms if slug}
    for platform_id, _name, slug in platforms:
        if slug and slug.startswith("duplicate-"):
            canonical_id = by_slug.get(slug.removeprefix("duplicate-"))
            if canonical_id is not None:
                duplicate_pairs.append((canonical_id, platform_id))

    for canonical_id, dup_id in duplicate_pairs:
        bind.execute(
            sa.text("UPDATE library_items SET platform_id = :canonical WHERE platform_id = :dup"),
            {"canonical": canonical_id, "dup": dup_id},
        )
        bind.execute(
            sa.text("UPDATE release_dates SET platform_id = :canonical WHERE platform_id = :dup"),
            {"canonical": canonical_id, "dup": dup_id},
        )
        # game_platforms has a composite (game_id, platform_id) primary key, so repointing
        # could collide with a row the game already has for the canonical platform — drop
        # those first, then repoint whatever's left.
        bind.execute(
            sa.text(
                "DELETE FROM game_platforms WHERE platform_id = :dup AND game_id IN "
                "(SELECT game_id FROM game_platforms WHERE platform_id = :canonical)"
            ),
            {"canonical": canonical_id, "dup": dup_id},
        )
        bind.execute(
            sa.text("UPDATE game_platforms SET platform_id = :canonical WHERE platform_id = :dup"),
            {"canonical": canonical_id, "dup": dup_id},
        )
        bind.execute(sa.text("DELETE FROM platforms WHERE id = :dup"), {"dup": dup_id})


def downgrade() -> None:
    # Merging reassigns foreign keys and deletes rows; there's no record of which
    # library_items/game_platforms/release_dates rows pointed at which duplicate
    # beforehand, so this can't be reconstructed.
    pass
