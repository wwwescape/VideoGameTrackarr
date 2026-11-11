"""lab features and game cases

Revision ID: a3c5e7f9b1d2
Revises: f8b0d2e4a6c7
Create Date: 2026-11-10 12:00:00.000000

Settings > Labs' on/off flags (lab_features), and the Game Shelf's predefined game cases
(game_cases), seeded from docs/data/game_cases/Game_Cases.csv (normally re-loaded with
`python -m scripts.import_game_cases`), same bake-the-CSV-in pattern as the hardware and
Toys-to-Life seeds. `INSERT OR IGNORE` on the platform_slug unique key keeps it safe against a
DB that already has the rows from a manual import.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3c5e7f9b1d2'
down_revision: Union[str, None] = 'f8b0d2e4a6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS = ('platform_slug', 'platform_name', 'case_label', 'height_mm', 'spine_mm', 'case_color', 'logo_band_color', 'logo_band_height_pct', 'logo', 'title_band_color', 'title_text_color')

# platform_slug, platform_name, case_label, height_mm, spine_mm, case_color, logo_band_color,
# logo_band_height_pct, logo, title_band_color, title_text_color
_GAME_CASES = [
    ('ps', 'PlayStation', 'CD jewel case', 142.0, 10.0, '#111111', '#111111', 18.0, None, '#111111', '#ffffff'),
    ('ps2', 'PlayStation 2', 'DVD case', 190.0, 14.0, '#0b0b0b', '#0b0b0b', 38.0, None, '#ffffff', '#111111'),
    ('ps3', 'PlayStation 3', 'Blu-ray case', 171.0, 12.0, '#151515', '#000000', 24.0, None, '#1c1c1c', '#ffffff'),
    ('ps4', 'PlayStation 4', 'Blu-ray case', 171.0, 12.0, '#00307a', '#00439c', 25.0, 'ps4.png', '#003791', '#ffffff'),
    ('ps5', 'PlayStation 5', 'Blu-ray case', 171.0, 12.0, '#1a3d8f', '#ffffff', 25.0, None, '#111111', '#ffffff'),
    ('psp', 'PlayStation Portable', 'UMD case', 178.0, 14.0, '#2a2a2a', '#111111', 30.0, None, '#111111', '#ffffff'),
    ('psvita', 'PlayStation Vita', 'PS Vita case', 137.0, 12.0, '#1d50c0', '#1f3d99', 25.0, None, '#1a1a1a', '#ffffff'),
    ('xbox', 'Xbox', 'DVD case', 190.0, 14.0, '#111111', '#4e9a06', 14.0, None, '#111111', '#ffffff'),
    ('xbox360', 'Xbox 360', 'DVD case', 190.0, 14.0, '#4e9a06', '#6cbf2a', 15.0, None, '#f2f2f2', '#111111'),
    ('xboxone', 'Xbox One', 'Blu-ray case', 171.0, 12.0, '#107c10', '#107c10', 14.0, None, '#ffffff', '#111111'),
    ('series-x-s', 'Xbox Series X|S', 'Blu-ray case', 171.0, 12.0, '#0e7a0d', '#0e0e0e', 12.0, None, '#ffffff', '#111111'),
    ('ngc', 'Nintendo GameCube', 'GameCube case', 190.0, 14.0, '#1a1a1a', '#1a1a1a', 12.0, None, '#1a1a1a', '#ffffff'),
    ('wii', 'Wii', 'DVD case', 190.0, 14.0, '#f2f2f2', '#ffffff', 12.0, None, '#ffffff', '#1a1a1a'),
    ('wiiu', 'Wii U', 'Wii U case', 171.0, 14.0, '#009ac7', '#009ac7', 14.0, None, '#006a94', '#ffffff'),
    ('switch', 'Nintendo Switch', 'Nintendo Switch case', 170.0, 10.5, '#e60012', '#e60012', 14.0, None, '#ffffff', '#111111'),
    ('switch-2', 'Nintendo Switch 2', 'Nintendo Switch 2 case', 170.0, 10.5, '#e60012', '#e60012', 14.0, None, '#ffffff', '#111111'),
    ('nds', 'Nintendo DS', 'Nintendo DS case', 137.0, 15.0, '#1a1a1a', '#ffffff', 25.0, None, '#ffffff', '#111111'),
    ('3ds', 'Nintendo 3DS', 'Nintendo 3DS case', 137.0, 12.0, '#ffffff', '#ffffff', 25.0, None, '#ffffff', '#111111'),
    ('new-nintendo-3ds', 'New Nintendo 3DS', 'Nintendo 3DS case', 137.0, 12.0, '#ffffff', '#ffffff', 25.0, None, '#ffffff', '#111111'),
    ('gb', 'Game Boy', 'Game Boy box', 140.0, 25.0, '#bdbdbd', '#ffffff', 30.0, 'gb.png', '#d6d6d6', '#111111'),
    ('gbc', 'Game Boy Color', 'Game Boy box', 140.0, 25.0, '#cfcfcf', '#ffffff', 30.0, None, '#e6e6e6', '#111111'),
    ('gba', 'Game Boy Advance', 'Game Boy Advance box', 140.0, 25.0, '#2a2f7a', '#ffffff', 30.0, None, '#ffffff', '#111111'),
    ('genesis-slash-megadrive', 'Sega Mega Drive/Genesis', 'Sega clamshell case', 184.0, 25.0, '#111111', '#111111', 14.0, None, '#111111', '#ffffff'),
    ('sms', 'Sega Master System', 'Sega clamshell case', 184.0, 25.0, '#111111', '#ffffff', 14.0, None, '#111111', '#ffffff'),
    ('saturn', 'Sega Saturn', 'Sega Saturn case', 212.0, 22.0, '#111111', '#111111', 14.0, None, '#111111', '#ffffff'),
    ('dc', 'Dreamcast', 'CD jewel case', 142.0, 10.0, '#ffffff', '#ffffff', 14.0, None, '#ffffff', '#111111'),
    ('segacd', 'Sega CD', 'CD jewel case', 142.0, 10.0, '#111111', '#111111', 12.0, None, '#111111', '#ffffff'),
]


def upgrade() -> None:
    op.create_table(
        'lab_features',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'game_cases',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('platform_slug', sa.String(length=64), nullable=False),
        sa.Column('platform_name', sa.String(length=255), nullable=False),
        sa.Column('case_label', sa.String(length=64), nullable=False),
        sa.Column('height_mm', sa.Float(), nullable=False),
        sa.Column('spine_mm', sa.Float(), nullable=False),
        sa.Column('case_color', sa.String(length=7), nullable=False),
        sa.Column('logo_band_color', sa.String(length=7), nullable=False),
        sa.Column('logo_band_height_pct', sa.Float(), nullable=False),
        sa.Column('logo', sa.String(length=64), nullable=True),
        sa.Column('title_band_color', sa.String(length=7), nullable=False),
        sa.Column('title_text_color', sa.String(length=7), nullable=False),
        sa.Column('shown', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('platform_slug'),
    )
    insert = sa.text(
        'INSERT OR IGNORE INTO game_cases (' + ', '.join(_COLUMNS) + ', shown) '
        'VALUES (' + ', '.join(':' + column for column in _COLUMNS) + ', 1)'
    )
    connection = op.get_bind()
    for row in _GAME_CASES:
        connection.execute(insert, dict(zip(_COLUMNS, row)))


def downgrade() -> None:
    op.drop_table('game_cases')
    op.drop_table('lab_features')
