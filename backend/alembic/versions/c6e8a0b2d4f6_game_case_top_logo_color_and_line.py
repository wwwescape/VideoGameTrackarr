"""game case top, logo colour and logo line

Revision ID: c6e8a0b2d4f6
Revises: a3c5e7f9b1d2
Create Date: 2026-11-11 12:00:00.000000

Three more Game_Cases.csv columns: how much of the case shows above the logo band
(case_top_mm, e.g. a PS3 case's clear top), an optional one-colour logo (logo_color), and an
optional line under the logo band (logo_line_color: PS3 red, PS4 white, PS5 blue). Then every
case's reference columns are re-synced from this snapshot of the CSV (new rows added); `shown`,
your Show on shelf choice, is never touched. A later CSV edit is still picked up with
`python -m scripts.import_game_cases`.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c6e8a0b2d4f6'
down_revision: Union[str, None] = 'a3c5e7f9b1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS = ('platform_slug', 'platform_name', 'case_label', 'height_mm', 'spine_mm', 'case_top_mm', 'case_color', 'logo_band_color', 'logo_band_height_pct', 'logo', 'logo_color', 'logo_line_color', 'title_band_color', 'title_text_color')

_GAME_CASES = [
    ('ps', 'PlayStation', 'CD jewel case', 142.0, 10.0, 2.0, '#111111', '#111111', 18.0, None, None, None, '#111111', '#ffffff'),
    ('ps2', 'PlayStation 2', 'DVD case', 190.0, 14.0, 4.0, '#0b0b0b', '#0b0b0b', 38.0, 'ps2.png', '#ffffff', None, '#ffffff', '#111111'),
    ('ps3', 'PlayStation 3', 'Blu-ray case', 171.0, 12.0, 17.0, '#d6d6d6', '#000000', 24.0, 'ps3.png', '#ffffff', '#d40000', '#1c1c1c', '#ffffff'),
    ('ps4', 'PlayStation 4', 'Blu-ray case', 171.0, 12.0, 6.0, '#00307a', '#00439c', 25.0, 'ps4.png', None, '#ffffff', '#003791', '#ffffff'),
    ('ps5', 'PlayStation 5', 'Blu-ray case', 171.0, 12.0, 6.0, '#1a3d8f', '#ffffff', 25.0, 'ps5.png', None, '#1f5fc8', '#111111', '#ffffff'),
    ('psp', 'PlayStation Portable', 'UMD case', 178.0, 14.0, 7.0, '#2a2a2a', '#111111', 30.0, 'psp.png', '#ffffff', None, '#111111', '#ffffff'),
    ('psvita', 'PlayStation Vita', 'PS Vita case', 137.0, 12.0, 6.0, '#1d50c0', '#1f3d99', 25.0, 'psvita.png', '#ffffff', None, '#1a1a1a', '#ffffff'),
    ('xbox', 'Xbox', 'DVD case', 190.0, 14.0, 4.0, '#111111', '#4e9a06', 14.0, 'xbox.png', None, None, '#111111', '#ffffff'),
    ('xbox360', 'Xbox 360', 'DVD case', 190.0, 14.0, 4.0, '#4e9a06', '#6cbf2a', 15.0, 'xbox360.png', None, None, '#f2f2f2', '#111111'),
    ('xboxone', 'Xbox One', 'Blu-ray case', 171.0, 12.0, 6.0, '#107c10', '#107c10', 14.0, 'xboxone.png', '#ffffff', None, '#ffffff', '#111111'),
    ('series-x-s', 'Xbox Series X|S', 'Blu-ray case', 171.0, 12.0, 6.0, '#0e7a0d', '#0e0e0e', 12.0, 'series-x-s.png', None, None, '#ffffff', '#111111'),
    ('ngc', 'Nintendo GameCube', 'GameCube case', 190.0, 14.0, 4.0, '#1a1a1a', '#1a1a1a', 12.0, None, None, None, '#1a1a1a', '#ffffff'),
    ('wii', 'Wii', 'DVD case', 190.0, 14.0, 4.0, '#f2f2f2', '#ffffff', 12.0, 'nintendo-wii.png', None, None, '#ffffff', '#1a1a1a'),
    ('wiiu', 'Wii U', 'Wii U case', 171.0, 14.0, 5.0, '#009ac7', '#009ac7', 14.0, 'nintendo-wii-u.png', '#ffffff', None, '#006a94', '#ffffff'),
    ('switch', 'Nintendo Switch', 'Nintendo Switch case', 170.0, 10.5, 4.0, '#e60012', '#e60012', 14.0, 'switch.png', None, None, '#ffffff', '#111111'),
    ('switch-2', 'Nintendo Switch 2', 'Nintendo Switch 2 case', 170.0, 10.5, 4.0, '#e60012', '#e60012', 14.0, 'switch-2.png', None, None, '#ffffff', '#111111'),
    ('nds', 'Nintendo DS', 'Nintendo DS case', 137.0, 15.0, 3.0, '#1a1a1a', '#ffffff', 25.0, None, None, None, '#ffffff', '#111111'),
    ('3ds', 'Nintendo 3DS', 'Nintendo 3DS case', 137.0, 12.0, 3.0, '#ffffff', '#ffffff', 25.0, '3ds.png', None, None, '#ffffff', '#111111'),
    ('new-nintendo-3ds', 'New Nintendo 3DS', 'Nintendo 3DS case', 137.0, 12.0, 3.0, '#ffffff', '#ffffff', 25.0, '3ds.png', None, None, '#ffffff', '#111111'),
    ('gb', 'Game Boy', 'Game Boy box', 140.0, 25.0, 0.0, '#bdbdbd', '#ffffff', 30.0, 'gb.png', None, None, '#d6d6d6', '#111111'),
    ('gbc', 'Game Boy Color', 'Game Boy box', 140.0, 25.0, 0.0, '#cfcfcf', '#ffffff', 30.0, 'gbc.png', None, None, '#e6e6e6', '#111111'),
    ('gba', 'Game Boy Advance', 'Game Boy Advance box', 140.0, 25.0, 0.0, '#2a2f7a', '#ffffff', 30.0, 'gba.png', None, None, '#ffffff', '#111111'),
    ('genesis-slash-megadrive', 'Sega Mega Drive/Genesis', 'Sega clamshell case', 184.0, 25.0, 3.0, '#111111', '#111111', 14.0, None, None, None, '#111111', '#ffffff'),
    ('sms', 'Sega Master System', 'Sega clamshell case', 184.0, 25.0, 3.0, '#111111', '#ffffff', 14.0, None, None, None, '#111111', '#ffffff'),
    ('saturn', 'Sega Saturn', 'Sega Saturn case', 212.0, 22.0, 4.0, '#111111', '#111111', 14.0, None, None, None, '#111111', '#ffffff'),
    ('dc', 'Dreamcast', 'CD jewel case', 142.0, 10.0, 2.0, '#ffffff', '#ffffff', 14.0, None, None, None, '#ffffff', '#111111'),
    ('segacd', 'Sega CD', 'CD jewel case', 142.0, 10.0, 2.0, '#111111', '#111111', 12.0, None, None, None, '#111111', '#ffffff'),
]


def upgrade() -> None:
    with op.batch_alter_table('game_cases') as batch:
        batch.add_column(sa.Column('case_top_mm', sa.Float(), server_default='0', nullable=False))
        batch.add_column(sa.Column('logo_color', sa.String(length=7), nullable=True))
        batch.add_column(sa.Column('logo_line_color', sa.String(length=7), nullable=True))

    connection = op.get_bind()
    insert = sa.text(
        'INSERT OR IGNORE INTO game_cases (' + ', '.join(_COLUMNS) + ', shown) '
        'VALUES (' + ', '.join(':' + column for column in _COLUMNS) + ', 1)'
    )
    update = sa.text(
        'UPDATE game_cases SET '
        + ', '.join(f'{column} = :{column}' for column in _COLUMNS[1:])
        + ', updated_at = CURRENT_TIMESTAMP WHERE platform_slug = :platform_slug'
    )
    for row in _GAME_CASES:
        values = dict(zip(_COLUMNS, row))
        connection.execute(insert, values)
        connection.execute(update, values)


def downgrade() -> None:
    with op.batch_alter_table('game_cases') as batch:
        batch.drop_column('logo_line_color')
        batch.drop_column('logo_color')
        batch.drop_column('case_top_mm')
