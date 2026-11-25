"""add manual_url to hardware reference entries and Toys-to-Life items

Revision ID: d0f2b4c6e8a3
Revises: c9e1a3b5d7f2
Create Date: 2026-11-25 12:20:00.000000

Manuals & Documents: the manufacturer's own manual page for a curated hardware SKU, and the
official LEGO building instructions for a LEGO Dimensions pack, offered as a one-click Manual
link on the detail page. Baked in from the CSVs' new "Manual URL" column (docs/data/hardware/,
docs/data/toys_to_life/), the same way the seed migrations bake the reference rows in, so an
existing install gets them without re-running an import. Rows the CSVs leave blank stay NULL.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd0f2b4c6e8a3'
down_revision: Union[str, None] = 'c9e1a3b5d7f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NINTENDO_WII_U = "https://en-americas-support.nintendo.com/app/answers/detail/a_id/16886"
_NINTENDO_WII = "https://en-americas-support.nintendo.com/app/answers/detail/a_id/16890"
_NINTENDO_3DS = "https://en-americas-support.nintendo.com/app/answers/detail/a_id/16903"
_NINTENDO_DS = "https://en-americas-support.nintendo.com/app/answers/detail/a_id/16905"
_NINTENDO_GAMECUBE_GBA = "https://en-americas-support.nintendo.com/app/answers/detail/a_id/16961"
_NINTENDO_SWITCH = "https://en-americas-support.nintendo.com/app/answers/detail/a_id/22496"
_PS3 = "https://manuals.playstation.net/document/en/ps3/current/"
_PS4 = "https://manuals.playstation.net/document/en/ps4/"
_PSP = "https://manuals.playstation.net/document/en/psp/current/"
_PSTV = "https://manuals.playstation.net/document/en/pstv/"
_PS_VITA = "https://manuals.playstation.net/document/en/psvita/"
_XBOX = "https://support.xbox.com/en-US/help/hardware-network/console/manuals-specs"
_PLAYSTATION = "https://www.playstation.com/en-us/support/hardware/manuals/"

# official_name → manual URL
HARDWARE_MANUAL_URLS = {
    "Microsoft Xbox 360": _XBOX,
    "Microsoft Xbox 360 S": _XBOX,
    "Microsoft Xbox 360 E": _XBOX,
    "Microsoft Xbox 360 Wireless Controller": _XBOX,
    "Microsoft Kinect Sensor": _XBOX,
    "Microsoft Xbox 360 Media Remote": _XBOX,
    "Microsoft Xbox 360 Chatpad": _XBOX,
    "Microsoft Xbox 360 Play & Charge Kit": _XBOX,
    "Microsoft Xbox One S": _XBOX,
    "Microsoft Xbox One X": _XBOX,
    "Microsoft Xbox Wireless Controller": _XBOX,
    "Microsoft Xbox Series X": _XBOX,
    "Microsoft Xbox Series S": _XBOX,
    "Microsoft Xbox Elite Wireless Controller Series 2": _XBOX,
    "Microsoft Xbox Adaptive Controller": _XBOX,
    "Nintendo GameCube": _NINTENDO_GAMECUBE_GBA,
    "Nintendo Wii": _NINTENDO_WII,
    "Nintendo Wii U": _NINTENDO_WII_U,
    "Nintendo Switch": _NINTENDO_SWITCH,
    "Nintendo Switch Lite": _NINTENDO_SWITCH,
    "Nintendo Switch – OLED Model": _NINTENDO_SWITCH,
    "Nintendo Game Boy Advance": _NINTENDO_GAMECUBE_GBA,
    "Nintendo Game Boy Advance SP": _NINTENDO_GAMECUBE_GBA,
    "Nintendo Game Boy Micro": _NINTENDO_GAMECUBE_GBA,
    "Nintendo DS": _NINTENDO_DS,
    "Nintendo DS Lite": _NINTENDO_DS,
    "Nintendo DSi": _NINTENDO_DS,
    "Nintendo DSi XL": _NINTENDO_DS,
    "Nintendo 3DS": _NINTENDO_3DS,
    "Nintendo 3DS XL": _NINTENDO_3DS,
    "New Nintendo 3DS": _NINTENDO_3DS,
    "New Nintendo 3DS XL": _NINTENDO_3DS,
    "Nintendo 2DS": _NINTENDO_3DS,
    "New Nintendo 2DS XL": _NINTENDO_3DS,
    "Nintendo WaveBird Wireless Controller": _NINTENDO_GAMECUBE_GBA,
    "Nintendo Game Boy Player": _NINTENDO_GAMECUBE_GBA,
    "Nintendo DK Bongos": _NINTENDO_GAMECUBE_GBA,
    "Nintendo e-Reader": _NINTENDO_GAMECUBE_GBA,
    "Nintendo Wii Remote": _NINTENDO_WII,
    "Nintendo Wii MotionPlus": _NINTENDO_WII,
    "Nintendo Wii Balance Board": _NINTENDO_WII,
    "Sony PlayStation Vita": _PS_VITA,
    "Sony PlayStation TV": _PSTV,
    "Sony PlayStation VR Headset": _PLAYSTATION,
    "Sony PlayStation 3": _PS3,
    "Sony PlayStation Move Motion Controller": _PLAYSTATION,
    "Sony PlayStation 3 Slim": _PS3,
    "Sony PlayStation 3 Super Slim": _PS3,
    "Sony PlayStation 4": _PS4,
    "Sony DualShock 4 Wireless Controller": _PLAYSTATION,
    "Sony PlayStation Camera": _PLAYSTATION,
    "Sony PlayStation VR Processor Unit": _PLAYSTATION,
    "Sony PlayStation VR Aim Controller": _PLAYSTATION,
    "Sony PlayStation 4 Slim": _PS4,
    "Sony PlayStation 4 Pro": _PS4,
    "Sony PlayStation 5 Disc Edition": _PLAYSTATION,
    "Sony Access Controller": _PLAYSTATION,
    "Sony DualSense Edge Controller": _PLAYSTATION,
    "Sony PlayStation VR2 Headset": _PLAYSTATION,
    "Sony PlayStation VR2 Sense Controller (Left)": _PLAYSTATION,
    "Sony PlayStation VR2 Sense Controller (Right)": _PLAYSTATION,
    "Sony PlayStation Portal": _PLAYSTATION,
    "Sony PlayStation Media Remote (PlayStation 5)": _PLAYSTATION,
    "Sony DualSense Charging Station": _PLAYSTATION,
    "Sony PlayStation VR2 Sense Controller Charging Station": _PLAYSTATION,
    "Sony PULSE 3D Wireless Headset": _PLAYSTATION,
    "Sony PULSE Elite Wireless Headset": _PLAYSTATION,
    "Sony PULSE Explore Wireless Earbuds": _PLAYSTATION,
    "Sony HD Camera": _PLAYSTATION,
    "Sony PlayStation 5 Digital Edition": _PLAYSTATION,
    "Sony PlayStation 5 Slim Disc Edition": _PLAYSTATION,
    "Sony PlayStation 5 Slim Digital Edition": _PLAYSTATION,
    "Sony PlayStation 5 Pro": _PLAYSTATION,
    "Sony PlayStation Disc Drive": _PLAYSTATION,
    "Sony PlayStation Portable": _PSP,
    "Sony PSPgo": _PSP,
    "Sony DualSense Wireless Controller": _PLAYSTATION,
    "Sony PlayStation Link USB Adapter": _PLAYSTATION,
}

# LEGO Dimensions packs with an official building-instructions page (71340 and 71342 have none).
LEGO_DIMENSIONS_SETS_WITH_INSTRUCTIONS = (
    "71170", "71171", "71172", "71173", "71174", "71201", "71202", "71203",
    "71204", "71205", "71206", "71207", "71209", "71210", "71211", "71212",
    "71213", "71214", "71215", "71216", "71217", "71218", "71219", "71220",
    "71221", "71222", "71223", "71227", "71228", "71229", "71230", "71231",
    "71232", "71233", "71234", "71235", "71236", "71237", "71238", "71239",
    "71240", "71241", "71242", "71244", "71245", "71246", "71247", "71248",
    "71251", "71253", "71255", "71256", "71257", "71258", "71264", "71266",
    "71267", "71285", "71286", "71287", "71343", "71344", "71346", "71348",
    "71349",
)


def upgrade() -> None:
    op.add_column("hardware_reference_entries", sa.Column("manual_url", sa.String(length=2048), nullable=True))
    op.add_column("toys_to_life_items", sa.Column("manual_url", sa.String(length=2048), nullable=True))
    hardware = sa.table(
        "hardware_reference_entries", sa.column("official_name", sa.String), sa.column("manual_url", sa.String)
    )
    for official_name, url in HARDWARE_MANUAL_URLS.items():
        op.execute(hardware.update().where(hardware.c.official_name == official_name).values(manual_url=url))
    items = sa.table(
        "toys_to_life_items",
        sa.column("line", sa.String),
        sa.column("set_number", sa.String),
        sa.column("manual_url", sa.String),
    )
    for set_number in LEGO_DIMENSIONS_SETS_WITH_INSTRUCTIONS:
        url = f"https://www.lego.com/en-us/service/building-instructions/{set_number}"
        op.execute(
            items.update()
            .where(items.c.line == "lego-dimensions", items.c.set_number == set_number)
            .values(manual_url=url)
        )


def downgrade() -> None:
    op.drop_column("toys_to_life_items", "manual_url")
    op.drop_column("hardware_reference_entries", "manual_url")
