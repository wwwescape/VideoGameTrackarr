"""Which uploaded ROMs can be played in-browser, and with which bundled EmulatorJS core.

Single source of truth for both halves of that question — the frontend never re-derives it,
it just reads the `playable`/`core` fields the API computes from here (see
schemas/library.py's RomFileSummary). Also feeds the About page's emulator-core credits
(GET /api/emulation), so the licenses shown there can't drift from what's bundled.

Adding a system later means: add its @emulatorjs/core-* package (with its npm integrity hash)
to frontend/scripts/vendor-emulatorjs.mjs, then add an EmulatorCore entry below —
tests/test_rom_routes.py fails if the two lists ever disagree. Files already uploaded for that
platform become playable immediately — nothing is stored per-ROM.

Only cores that run without a BIOS file are listed; BIOS-dependent systems (Sega CD, 3DO,
Lynx, Atari 5200, ColecoVision, PC Engine CD, Saturn), PlayStation, Arcade and the
thread-requiring cores (DOS, PSP — they need a cross-origin-isolated player) are later work.
"""

from dataclasses import dataclass
from enum import StrEnum

from app.models.library import MediaFormat

# Must match EJS_VERSION in frontend/scripts/vendor-emulatorjs.mjs — shown in About's credits.
EMULATORJS_VERSION = "4.2.3"


@dataclass(frozen=True)
class EmulatorCore:
    core: str  # EmulatorJS core id, passed as EJS_core and used as the cores/<core>-wasm.data name
    system: str  # human-readable system label for credits/debugging
    # IGDB platform slugs this core plays — including older/duplicate slugs some instances'
    # platforms tables still carry for the same system (e.g. both "sega32" and "32x").
    platform_slugs: frozenset[str]
    extensions: frozenset[str]  # lowercase, no dot
    license: str  # SPDX id where one exists, verified against the upstream repo's license file
    upstream_url: str
    # Redistribution allowed, but never in anything sold or commercial — flagged on About.
    non_commercial: bool = False


def _core(
    core: str,
    system: str,
    slugs: set[str],
    extensions: set[str],
    license: str,
    upstream_url: str,
    non_commercial: bool = False,
) -> EmulatorCore:
    return EmulatorCore(core, system, frozenset(slugs), frozenset(extensions), license, upstream_url, non_commercial)


# Only cores whose @emulatorjs/core-* package is actually vendored belong here — an entry
# without its core files would make EmulatorJS fall back to fetching the core from its CDN.
# Licenses checked 2026-09-27 against each upstream repo's own license file.
CORES: tuple[EmulatorCore, ...] = (
    # .fds (Famicom Disk System) is left out on purpose — it needs a BIOS file.
    _core("fceumm", "Nintendo Entertainment System / Famicom", {"nes", "famicom"}, {"nes", "unf", "unif"},
          "GPL-2.0", "https://github.com/libretro/libretro-fceumm"),
    _core("snes9x", "Super Nintendo / Super Famicom", {"snes", "sfam"}, {"sfc", "smc", "fig", "swc"},
          "Snes9x License", "https://github.com/libretro/snes9x", non_commercial=True),
    _core("gambatte", "Game Boy / Game Boy Color", {"gb", "gbc"}, {"gb", "gbc"},
          "GPL-2.0", "https://github.com/libretro/gambatte-libretro"),
    _core("mgba", "Game Boy Advance", {"gba"}, {"gba"},
          "MPL-2.0", "https://github.com/libretro/mgba"),
    _core("mupen64plus_next", "Nintendo 64", {"n64"}, {"n64", "z64", "v64"},
          "GPL-2.0", "https://github.com/libretro/mupen64plus-libretro-nx"),
    _core("melonds", "Nintendo DS", {"nds"}, {"nds"},
          "GPL-3.0", "https://github.com/libretro/melonDS"),
    _core("beetle_vb", "Virtual Boy", {"virtualboy", "virtual-boy"}, {"vb", "vboy"},
          "GPL-2.0", "https://github.com/libretro/beetle-vb-libretro"),
    _core("genesis_plus_gx", "Sega Genesis / Mega Drive, Master System, Game Gear",
          {"genesis", "genesis-slash-megadrive", "sms", "mastersystem", "gamegear"},
          {"md", "gen", "smd", "bin", "sms", "gg"},
          "Genesis Plus GX License", "https://github.com/libretro/Genesis-Plus-GX", non_commercial=True),
    _core("picodrive", "Sega 32X", {"sega32", "32x"}, {"32x", "bin"},
          "PicoDrive License", "https://github.com/libretro/picodrive", non_commercial=True),
    _core("stella2014", "Atari 2600", {"atari2600"}, {"a26", "bin"},
          "GPL-2.0", "https://github.com/libretro/stella2014-libretro"),
    _core("prosystem", "Atari 7800", {"atari7800"}, {"a78", "bin"},
          "GPL-2.0", "https://github.com/libretro/prosystem-libretro"),
    _core("virtualjaguar", "Atari Jaguar", {"jaguar"}, {"j64", "jag", "abs", "cof", "rom", "bin"},
          "GPL-3.0", "https://github.com/libretro/virtualjaguar-libretro"),
    _core("mednafen_pce", "PC Engine / TurboGrafx-16 / SuperGrafx",
          {"turbografx16--1", "turbografx-16", "supergrafx"}, {"pce", "sgx"},
          "GPL-2.0", "https://github.com/libretro/beetle-pce-libretro"),
    _core("mednafen_ngp", "Neo Geo Pocket / Color", {"neo-geo-pocket", "neo-geo-pocket-color"}, {"ngp", "ngc"},
          "GPL-2.0", "https://github.com/libretro/beetle-ngp-libretro"),
    _core("mednafen_wswan", "WonderSwan / Color", {"wonderswan", "wonderswan-color"}, {"ws", "wsc"},
          "GPL-2.0", "https://github.com/libretro/beetle-wswan-libretro"),
)

# Upload allowlists, per copy format. Deliberately much broader than CORES: a file for a
# system that isn't playable yet is still accepted and stored (it's the user's record of
# the file), it just doesn't light up "Play Game" until a core for it is added.
_CART_EXTENSIONS = frozenset(
    {
        "nes", "unf", "unif", "fds",  # NES / Famicom
        "sfc", "smc", "fig", "swc",  # SNES
        "gb", "gbc", "gba",  # Game Boy family
        "n64", "z64", "v64",  # N64
        "nds",  # DS
        "vb", "vboy",  # Virtual Boy
        "md", "gen", "smd", "sms", "gg", "32x",  # Sega carts
        "a26", "a52", "a78", "lnx", "j64", "jag", "abs", "cof", "rom",  # Atari
        "pce", "sgx",  # PC Engine / TurboGrafx
        "ngp", "ngc",  # Neo Geo Pocket
        "ws", "wsc",  # WonderSwan
        "col",  # ColecoVision
    }
)
_DISC_EXTENSIONS = frozenset({"iso", "cso", "chd", "cue", "bin", "img", "ccd", "m3u", "pbp"})
ARCHIVE_EXTENSION = "zip"

ALLOWED_UPLOAD_EXTENSIONS: dict[MediaFormat, frozenset[str]] = {
    MediaFormat.ROM: _CART_EXTENSIONS | {"bin", ARCHIVE_EXTENSION},
    MediaFormat.ABANDONWARE: frozenset({ARCHIVE_EXTENSION}),
    MediaFormat.ISO: frozenset({"iso", "cso", "chd", ARCHIVE_EXTENSION}),
}

# What counts as "the ROM" when looking inside an uploaded zip.
ROM_CONTENT_EXTENSIONS = _CART_EXTENSIONS | _DISC_EXTENSIONS

ROM_CAPABLE_FORMATS = frozenset(ALLOWED_UPLOAD_EXTENSIONS)


class UnplayableReason(StrEnum):
    UNSUPPORTED_PLATFORM = "unsupported_platform"
    UNSUPPORTED_FILE_TYPE = "unsupported_file_type"


def core_for_platform(platform_slug: str | None) -> EmulatorCore | None:
    if platform_slug is None:
        return None
    return next((c for c in CORES if platform_slug in c.platform_slugs), None)


def resolve_playability(
    platform_slug: str | None, extension: str
) -> tuple[EmulatorCore | None, UnplayableReason | None]:
    """(core, None) when playable, else (None, why). `extension` is RomFile.extension —
    for a zip that's the detected inner file's extension, so a zip is playable exactly when
    its contents would be."""
    core = core_for_platform(platform_slug)
    if core is None:
        return None, UnplayableReason.UNSUPPORTED_PLATFORM
    if extension.lower() not in core.extensions:
        return None, UnplayableReason.UNSUPPORTED_FILE_TYPE
    return core, None
