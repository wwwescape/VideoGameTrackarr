"""canonicalize playstation platform names and short names

Revision ID: f5e8f9b4b7e5
Revises: 24159ae06163
Create Date: 2026-06-24 08:13:41.038958

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5e8f9b4b7e5'
down_revision: Union[str, None] = '24159ae06163'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Sony's consoles are catalogued in this legacy-imported data without their manufacturer
# prefix (e.g. "PlayStation 4"), while a separate "Sony PlayStation 4" row already carries
# the desired name for some of the family and "Sony PlayStation Mobile" is the odd one out
# (should drop the prefix to match "PlayStation Mobile") — see BUGS.md for the canonical
# name/short-name list this was reconciled against. Renaming first and then re-running the
# same merge-by-key logic as 24159ae06163 (keyed on name this time, since the rename is
# what introduces the collision) cleans up the resulting duplicates in one pass.
RENAMES = {
    "PlayStation": "Sony PlayStation",
    "PlayStation 2": "Sony PlayStation 2",
    "PlayStation 3": "Sony PlayStation 3",
    "PlayStation 4": "Sony PlayStation 4",
    "PlayStation 5": "Sony PlayStation 5",
    "PlayStation Portable": "Sony PlayStation Portable",
    "PlayStation Vita": "Sony PlayStation Vita",
    "Sony PlayStation Mobile": "PlayStation Mobile",
    "Nintendo PlayStation": "Nintendo Play Station",
}

ABBREVIATIONS = {
    "Sony PlayStation": "PS1",
    "Sony PlayStation 2": "PS2",
    "Sony PlayStation 3": "PS3",
    "Sony PlayStation 4": "PS4",
    "Sony PlayStation 5": "PS5",
    "Sony PlayStation Portable": "PSP",
    "Sony PlayStation Vita": "PS Vita",
    "PlayStation Mobile": "PSM",
}


def upgrade() -> None:
    bind = op.get_bind()

    for old_name, new_name in RENAMES.items():
        bind.execute(
            sa.text("UPDATE platforms SET name = :new_name WHERE name = :old_name"),
            {"new_name": new_name, "old_name": old_name},
        )

    rows = bind.execute(sa.text("SELECT id, name FROM platforms")).fetchall()
    groups: dict[str, list[int]] = {}
    for platform_id, name in rows:
        groups.setdefault(name, []).append(platform_id)

    for ids in groups.values():
        if len(ids) <= 1:
            continue
        canonical_id = min(ids)
        for dup_id in ids:
            if dup_id == canonical_id:
                continue
            bind.execute(
                sa.text("UPDATE library_items SET platform_id = :canonical WHERE platform_id = :dup"),
                {"canonical": canonical_id, "dup": dup_id},
            )
            bind.execute(
                sa.text("UPDATE release_dates SET platform_id = :canonical WHERE platform_id = :dup"),
                {"canonical": canonical_id, "dup": dup_id},
            )
            # game_platforms has a composite (game_id, platform_id) primary key, so
            # repointing could collide with a row the game already has for the canonical
            # platform — drop those first, then repoint whatever's left.
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

    for name, abbreviation in ABBREVIATIONS.items():
        bind.execute(
            sa.text("UPDATE platforms SET abbreviation = :abbreviation WHERE name = :name"),
            {"abbreviation": abbreviation, "name": name},
        )


def downgrade() -> None:
    # Renames/merges/abbreviation backfills are lossy in the same way as 24159ae06163.
    pass
