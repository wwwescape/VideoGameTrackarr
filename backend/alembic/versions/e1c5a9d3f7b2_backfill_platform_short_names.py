"""backfill platform short names (abbreviations) and hardware reference short names

Revision ID: e1c5a9d3f7b2
Revises: d4b8f1a6c2e9
Create Date: 2026-09-28 00:00:00.000000

Most platform rows were created before VGT linked platforms to IGDB, and the later
bare-slug link (platform_repository.get_or_create_by_igdb) deliberately never touches
name/slug/abbreviation — so IGDB's abbreviation never arrived and dropdowns showed plain
names. This fills a curated short name for common gaming platforms, **only where the row has
none**, so any value already curated (PS1-PS5, PSP, PS Vita, SFAM, Sega32, Series X|S) or
edited by hand is left alone. Keyed by slug, including IGDB's current slugs and the older
variants some instances still carry for the same system.

Same idea for the hardware reference catalog: hardware_reference_entries.generation_short
(seeded from docs/data/hardware/*.csv's "Generation (Short)" column) was only filled for
PlayStation and part of Sega. The CSVs now carry a value for every generation; existing
rows get the same values here, again only where the column is still empty.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1c5a9d3f7b2'
down_revision: Union[str, None] = 'd4b8f1a6c2e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SHORT_NAMES: dict[str, str] = {
    # Nintendo
    "nes": "NES",
    "famicom": "FC",
    "fds": "FDS",
    "snes": "SNES",
    "sfam": "SFC",
    "n64": "N64",
    "nintendo-64dd": "64DD",
    "ngc": "GC",
    "wii": "Wii",
    "wiiu": "Wii U",
    "switch": "Switch",
    "switch-2": "Switch 2",
    "gb": "GB",
    "gbc": "GBC",
    "gba": "GBA",
    "nds": "NDS",
    "nintendo-dsi": "DSi",
    "3ds": "3DS",
    "new-nintendo-3ds": "New 3DS",
    "virtual-boy": "VB",
    "virtualboy": "VB",
    "game-and-watch": "G&W",
    "pokemon-mini": "PKMN mini",
    # Sega
    "sg1000": "SG-1000",
    "sms": "SMS",
    "mastersystem": "SMS",
    "genesis": "Genesis",
    "genesis-slash-megadrive": "Genesis",
    "segacd": "SCD",
    "32x": "32X",
    "sega32": "32X",
    "gamegear": "GG",
    "saturn": "SAT",
    "dc": "DC",
    # Microsoft
    "xbox": "Xbox",
    "xbox360": "X360",
    "xboxone": "XB1",
    "series-x-s": "Series X|S",
    "xbox-series-x": "Series X|S",
    "win": "PC",
    # Sony (only rows still missing one — curated values are never overwritten)
    "ps": "PS1",
    "playstation": "PS1",
    "ps2": "PS2",
    "ps3": "PS3",
    "ps4--1": "PS4",
    "ps4": "PS4",
    "ps5": "PS5",
    "psp": "PSP",
    "psvita": "PS Vita",
    "pocketstation": "PocketStation",
    # Computers / other OSes
    "mac": "Mac",
    "linux": "Linux",
    "dos": "DOS",
    "amiga": "Amiga",
    "amiga-cd32": "CD32",
    "c64": "C64",
    "vic-20": "VIC-20",
    "atari-st": "ST",
    "atari8bit": "Atari 8-bit",
    "msx": "MSX",
    "msx2": "MSX2",
    "zx-spectrum": "ZX Spectrum",
    "sinclair-zx-spectrum": "ZX Spectrum",
    "acpc": "CPC",
    "appleii": "Apple II",
    "apple-iigs": "IIGS",
    "pc-8800-series": "PC-88",
    "pc-9800-series": "PC-98",
    "sharp-x68000": "X68000",
    "fm-towns": "FM Towns",
    # Mobile
    "android": "Android",
    "ios": "iOS",
    # Atari
    "atari2600": "2600",
    "atari5200": "5200",
    "atari7800": "7800",
    "jaguar": "Jaguar",
    "atari-jaguar-cd": "Jaguar CD",
    "lynx": "Lynx",
    # NEC
    "turbografx-16": "TG-16",
    "turbografx16--1": "TG-16",
    "turbografx-cd": "TG-CD",
    "supergrafx": "SGX",
    "pc-fx": "PC-FX",
    # SNK
    "neogeoaes": "AES",
    "neogeomvs": "MVS",
    "neo-geo-cd": "NGCD",
    "neo-geo-pocket": "NGP",
    "neo-geo-pocket-color": "NGPC",
    "hyper-neo-geo-64": "HNG64",
    # Bandai
    "wonderswan": "WS",
    "wonderswan-color": "WSC",
    # Others
    "3do": "3DO",
    "cdi": "CD-i",
    "colecovision": "CV",
    "intellivision": "INTV",
    "odyssey-2-slash-videopac-g7000": "Odyssey²",
    "ngage": "N-Gage",
    "stadia": "Stadia",
    "ouya": "Ouya",
    "evercade": "Evercade",
    "arcade": "Arcade",
}


# Must match docs/data/hardware/*.csv's "Generation (Short)" column for these generations.
HARDWARE_GENERATION_SHORT_NAMES: dict[str, str] = {
    "NES": "NES",
    "SNES": "SNES",
    "Nintendo 64": "N64",
    "GameCube": "GC",
    "Wii": "Wii",
    "Wii U": "Wii U",
    "Nintendo Switch": "Switch",
    "Nintendo Switch 2": "Switch 2",
    "Game Boy": "GB",
    "Game Boy Color": "GBC",
    "Game Boy Advance": "GBA",
    "Nintendo DS": "NDS",
    "Nintendo 3DS": "3DS",
    "Xbox": "Xbox",
    "Xbox 360": "X360",
    "Xbox One": "XB1",
    "Xbox Series": "Series X|S",
    "Genesis": "Genesis",
    "Sega CD": "SCD",
    "32X": "32X",
    "Saturn": "SAT",
}


def upgrade() -> None:
    platforms = sa.table(
        "platforms",
        sa.column("slug", sa.String),
        sa.column("abbreviation", sa.String),
    )
    for slug, short_name in SHORT_NAMES.items():
        op.execute(
            platforms.update()
            .where(platforms.c.slug == slug)
            .where(sa.or_(platforms.c.abbreviation.is_(None), platforms.c.abbreviation == ""))
            .values(abbreviation=short_name)
        )

    entries = sa.table(
        "hardware_reference_entries",
        sa.column("generation", sa.String),
        sa.column("generation_short", sa.String),
    )
    for generation, short_name in HARDWARE_GENERATION_SHORT_NAMES.items():
        op.execute(
            entries.update()
            .where(entries.c.generation == generation)
            .where(sa.or_(entries.c.generation_short.is_(None), entries.c.generation_short == ""))
            .values(generation_short=short_name)
        )


def downgrade() -> None:
    # Data-only backfill: there's no way to tell a filled value from one set by hand
    # afterwards, so leave the data alone (same convention as this repo's other data
    # migrations).
    pass
