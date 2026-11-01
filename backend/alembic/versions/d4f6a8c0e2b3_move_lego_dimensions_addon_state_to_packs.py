"""move LEGO Dimensions add-on state to the packs

Revision ID: d4f6a8c0e2b3
Revises: c8e2a4f6b0d1
Create Date: 2026-11-02 01:00:00.000000

Before Toys to Life, a LEGO Dimensions pack could only be tracked as an add-on of the game, and
owning the game on a platform meant owning that platform's starter kit. The add-on rows are
now hidden, so what you tracked on them moves to the packs (the same rules as
app/services/toys_to_life_adoption.py, which also runs after restoring an older backup; it's
repeated here in SQL because migrations don't import app code):

- each add-on copy becomes a copy of the pack, owned or wishlisted as it was, with its price,
  and its other details and notes as the pack copy's notes; the add-on copy is removed (one
  with ROM files stays);
- its rating (when the pack has none), notes and tags move to the pack;
- a copy of LEGO Dimensions on a platform gives that platform's starter kit a copy, owned or
  wishlisted (owned when there are both), unless the kit already has copies. The game's copy
  stays.

Downgrade leaves the moved state where it is: the removed add-on copies can't be rebuilt
(their details are in the pack copies' notes).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4f6a8c0e2b3'
down_revision: Union[str, None] = 'c8e2a4f6b0d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# The lines' base games when this migration was written (LEGO Dimensions on IGDB).
_LINE_GAME_IGDB_IDS = (11077,)

_FORMAT_LABELS = {
    "physical": "Physical",
    "digital": "Digital",
    "iso": "ISO",
    "rom": "ROM",
    "abandonware": "Abandonware",
    "other": "Other",
}


def _copy_notes(game_name, copy) -> str:
    fmt = copy.format
    parts = [
        copy.platform_name,
        _FORMAT_LABELS.get(fmt, fmt) if fmt else None,
        copy.digital_storefront,
        f"Region {copy.region_name}" if copy.region_name else None,
        copy.edition,
        f"Acquired {str(copy.acquired_at)[:10]}" if copy.acquired_at else None,
        "Steelbook" if copy.steelbook else None,
    ]
    details = " · ".join(part for part in parts if part)
    note = f"Moved from the add-on “{game_name}”" + (f": {details}" if details else "")
    return f"{note}\n{copy.notes}" if copy.notes else note


def _add_copy(conn, item_id: int, status: str, price=None, notes=None) -> None:
    conn.execute(
        sa.text(
            "INSERT INTO toys_to_life_copies (item_id, status, price, notes) VALUES (:item, :status, :price, :notes)"
        ),
        {"item": item_id, "status": status, "price": price, "notes": notes},
    )


def upgrade() -> None:
    conn = op.get_bind()
    line_ids = ", ".join(str(igdb_id) for igdb_id in _LINE_GAME_IGDB_IDS)

    rows = conn.execute(
        sa.text(
            "SELECT g.id AS game_id, g.name AS game_name, g.user_rating AS game_rating, "
            "t.id AS item_id, t.user_rating AS item_rating "
            "FROM games g JOIN toys_to_life_items t ON t.igdb_id = g.igdb_id AND t.platform_igdb_id IS NULL "
            f"WHERE g.igdb_id NOT IN ({line_ids})"
        )
    ).all()
    for row in rows:
        copies = conn.execute(
            sa.text(
                "SELECT li.id, li.status, li.format, li.digital_storefront, li.edition, li.price, li.acquired_at, "
                "li.steelbook, li.notes, p.name AS platform_name, r.name AS region_name "
                "FROM library_items li LEFT JOIN platforms p ON p.id = li.platform_id "
                "LEFT JOIN regions r ON r.id = li.region_id WHERE li.game_id = :game ORDER BY li.id"
            ),
            {"game": row.game_id},
        ).all()
        notes = conn.execute(
            sa.text("SELECT id, body FROM notes WHERE game_id = :game ORDER BY id"), {"game": row.game_id}
        ).all()
        tag_ids = conn.execute(
            sa.text("SELECT tag_id FROM game_tags WHERE game_id = :game"), {"game": row.game_id}
        ).scalars().all()
        if not (copies or notes or tag_ids or row.game_rating is not None):
            continue

        if row.item_rating is None and row.game_rating is not None:
            conn.execute(
                sa.text("UPDATE toys_to_life_items SET user_rating = :rating WHERE id = :item"),
                {"rating": row.game_rating, "item": row.item_id},
            )
        conn.execute(sa.text("UPDATE games SET user_rating = NULL WHERE id = :game"), {"game": row.game_id})
        for tag_id in tag_ids:
            conn.execute(
                sa.text("INSERT OR IGNORE INTO toys_to_life_tags (item_id, tag_id) VALUES (:item, :tag)"),
                {"item": row.item_id, "tag": tag_id},
            )
        conn.execute(sa.text("DELETE FROM game_tags WHERE game_id = :game"), {"game": row.game_id})
        for note in notes:
            conn.execute(
                sa.text("INSERT INTO toys_to_life_notes (item_id, body) VALUES (:item, :body)"),
                {"item": row.item_id, "body": note.body},
            )
        conn.execute(sa.text("DELETE FROM notes WHERE game_id = :game"), {"game": row.game_id})
        for copy in copies:
            _add_copy(conn, row.item_id, copy.status, copy.price, _copy_notes(row.game_name, copy))
            has_roms = conn.execute(
                sa.text("SELECT 1 FROM rom_files WHERE library_item_id = :copy LIMIT 1"), {"copy": copy.id}
            ).first()
            if has_roms is None:
                conn.execute(sa.text("DELETE FROM library_items WHERE id = :copy"), {"copy": copy.id})

    base_copies = conn.execute(
        sa.text(
            "SELECT t.id AS item_id, li.status FROM library_items li "
            "JOIN games g ON g.id = li.game_id JOIN platforms p ON p.id = li.platform_id "
            "JOIN toys_to_life_items t ON t.igdb_id = g.igdb_id AND t.platform_igdb_id = p.igdb_id "
            f"WHERE g.igdb_id IN ({line_ids}) "
            # Owned copies first, so an owned and a wishlisted copy on one platform make it owned.
            "ORDER BY li.status != 'owned'"
        )
    ).all()
    given = set()
    for copy in base_copies:
        has_copies = conn.execute(
            sa.text("SELECT 1 FROM toys_to_life_copies WHERE item_id = :item LIMIT 1"), {"item": copy.item_id}
        ).first()
        if copy.item_id in given or has_copies is not None:
            continue
        _add_copy(conn, copy.item_id, copy.status)
        given.add(copy.item_id)


def downgrade() -> None:
    pass
