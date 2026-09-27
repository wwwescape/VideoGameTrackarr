"""Which uploaded ROMs can be played in-browser, and with which bundled EmulatorJS core.

Single source of truth for both halves of that question — the frontend never re-derives it,
it just reads the `playable`/`core` fields the API computes from here (see
schemas/library.py's RomFileSummary). Also feeds the About page's emulator-core credits and
the Settings → Emulation BIOS page (GET /api/emulation, GET /api/emulation/bios), so the
licenses and BIOS requirements shown there can't drift from what's bundled.

Adding a system later means: add its @emulatorjs/core-* package (with its npm integrity hash)
to frontend/scripts/vendor-emulatorjs.mjs, then add an EmulatorCore entry below —
tests/test_rom_routes.py fails if the two lists ever disagree. Files already uploaded for that
platform become playable immediately — nothing is stored per-ROM.

Not bundled: arcade. FBNeo's license forbids asking for donations on a project
using it, and the alternatives were declined for now.
"""

from dataclasses import dataclass, field
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
    # An uploaded archive is playable whatever it contains (DOSBox Pure mounts a whole game
    # folder zip), not just when a ROM-looking file is found inside.
    accepts_any_archive: bool = False
    # Needs SharedArrayBuffer (EmulatorJS's EJS_threads) — only possible on a cross-origin-
    # isolated page, so these open in their own tab (frontend/player-isolated.html).
    requires_threads: bool = False
    # Key into BIOS_SYSTEMS; required=True means unplayable until a matching BIOS is uploaded.
    bios_system: str | None = None
    bios_required: bool = False


def _core(
    core: str,
    system: str,
    slugs: set[str],
    extensions: set[str],
    license: str,
    upstream_url: str,
    **options,
) -> EmulatorCore:
    return EmulatorCore(core, system, frozenset(slugs), frozenset(extensions), license, upstream_url, **options)


# Only cores whose @emulatorjs/core-* package is actually vendored belong here — an entry
# without its core files would make EmulatorJS fall back to fetching the core from its CDN.
# One core can appear more than once when it plays several systems with different rules
# (e.g. Genesis Plus GX: cartridges need no BIOS, Sega CD does). Licenses checked against
# each upstream repo's own license file (2026-09-27/28).
_DISC = {"cue", "bin", "chd", "iso", "img", "ccd", "m3u"}
CORES: tuple[EmulatorCore, ...] = (
    _core("fceumm", "Nintendo Entertainment System / Famicom", {"nes", "famicom"}, {"nes", "unf", "unif"},
          "GPL-2.0", "https://github.com/libretro/libretro-fceumm"),
    _core("fceumm", "Famicom Disk System", {"fds"}, {"fds"},
          "GPL-2.0", "https://github.com/libretro/libretro-fceumm", bios_system="fds", bios_required=True),
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
    _core("genesis_plus_gx", "Sega CD / Mega-CD", {"segacd"}, _DISC,
          "Genesis Plus GX License", "https://github.com/libretro/Genesis-Plus-GX", non_commercial=True,
          bios_system="segacd", bios_required=True),
    _core("picodrive", "Sega 32X", {"sega32", "32x"}, {"32x", "bin"},
          "PicoDrive License", "https://github.com/libretro/picodrive", non_commercial=True),
    _core("yabause", "Sega Saturn", {"saturn"}, _DISC,
          "GPL-2.0", "https://github.com/libretro/yabause", bios_system="saturn"),
    _core("pcsx_rearmed", "PlayStation", {"ps", "playstation"}, _DISC | {"pbp"},
          "GPL-2.0", "https://github.com/libretro/pcsx_rearmed", bios_system="psx"),
    _core("ppsspp", "PlayStation Portable", {"psp"}, {"iso", "cso", "pbp", "elf", "chd"},
          "GPL-2.0", "https://github.com/hrydgard/ppsspp", requires_threads=True),
    _core("stella2014", "Atari 2600", {"atari2600"}, {"a26", "bin"},
          "GPL-2.0", "https://github.com/libretro/stella2014-libretro"),
    _core("a5200", "Atari 5200", {"atari5200"}, {"a52", "bin"},
          "GPL-2.0", "https://github.com/libretro/a5200", bios_system="atari5200", bios_required=True),
    _core("prosystem", "Atari 7800", {"atari7800"}, {"a78", "bin"},
          "GPL-2.0", "https://github.com/libretro/prosystem-libretro"),
    _core("handy", "Atari Lynx", {"lynx"}, {"lnx", "o"},
          "Zlib", "https://github.com/libretro/libretro-handy", bios_system="lynx", bios_required=True),
    _core("virtualjaguar", "Atari Jaguar", {"jaguar"}, {"j64", "jag", "abs", "cof", "rom", "bin"},
          "GPL-3.0", "https://github.com/libretro/virtualjaguar-libretro"),
    _core("mednafen_pce", "PC Engine / TurboGrafx-16 / SuperGrafx",
          {"turbografx16--1", "turbografx-16", "supergrafx"}, {"pce", "sgx"},
          "GPL-2.0", "https://github.com/libretro/beetle-pce-libretro"),
    _core("mednafen_pce", "PC Engine CD / TurboGrafx-CD", {"turbografx-cd", "pc-engine-cd"}, {"cue", "chd", "ccd"},
          "GPL-2.0", "https://github.com/libretro/beetle-pce-libretro", bios_system="pcecd", bios_required=True),
    _core("mednafen_ngp", "Neo Geo Pocket / Color", {"neo-geo-pocket", "neo-geo-pocket-color"}, {"ngp", "ngc"},
          "GPL-2.0", "https://github.com/libretro/beetle-ngp-libretro"),
    _core("mednafen_wswan", "WonderSwan / Color", {"wonderswan", "wonderswan-color"}, {"ws", "wsc"},
          "GPL-2.0", "https://github.com/libretro/beetle-wswan-libretro"),
    _core("gearcoleco", "ColecoVision", {"colecovision"}, {"col", "rom", "bin"},
          "GPL-3.0", "https://github.com/drhelius/Gearcoleco", bios_system="colecovision", bios_required=True),
    _core("opera", "3DO Interactive Multiplayer", {"3do"}, _DISC,
          "Opera License (modified LGPL, non-commercial)", "https://github.com/libretro/opera-libretro",
          non_commercial=True, bios_system="3do", bios_required=True),
    _core("dosbox_pure", "DOS", {"dos"}, {"dosz", "exe", "com", "bat", "iso", "cue", "img"},
          "GPL-2.0", "https://github.com/schellingb/dosbox-pure", accepts_any_archive=True, requires_threads=True),
)


@dataclass(frozen=True)
class BiosFileSpec:
    filename: str  # exact name the core looks for — the file is written under this name
    md5s: frozenset[str] = field(default_factory=frozenset)  # known-good dumps (libretro docs)
    # Whether this file on its own satisfies a required-BIOS system (Kanji/extra ROMs don't).
    satisfies: bool = True
    note: str | None = None


@dataclass(frozen=True)
class BiosSystem:
    key: str
    label: str
    files: tuple[BiosFileSpec, ...]
    required: bool  # False: the core runs without one (e.g. PCSX ReARMed's built-in HLE BIOS)

    def spec_for(self, filename: str) -> BiosFileSpec | None:
        return next((f for f in self.files if f.filename.lower() == filename.lower()), None)


def _bios(filename: str, *md5s: str, satisfies: bool = True, note: str | None = None) -> BiosFileSpec:
    return BiosFileSpec(filename, frozenset(m.lower() for m in md5s), satisfies, note)


# Filenames and known-good MD5s are exactly as libretro documents them for each core
# (docs.libretro.com/library/<core>/ and the Opera core's README) — none are guessed.
BIOS_SYSTEMS: dict[str, BiosSystem] = {
    system.key: system
    for system in (
        BiosSystem("psx", "PlayStation", (
            _bios("scph5501.bin", "490f666e1afb15b7362b406ed1cea246", note="US"),
            _bios("scph1001.bin", "924e392ed05558ffdb115408c263dccf", note="US"),
            _bios("scph7001.bin", "1e68c231d0896b7eadcad1d7d8e76129", note="US"),
            _bios("scph101.bin", "6e3735ff4c7dc899ee98981385f6f3d0", note="PS one"),
            _bios("PSXONPSP660.bin", "c53ca5908936d412331790f4426c6c33", note="From a PSP, region-free"),
        ), required=False),
        BiosSystem("segacd", "Sega CD / Mega-CD", (
            _bios("bios_CD_U.bin", "854b9150240a198070150e4566ae1290", note="US (Sega CD)"),
            _bios("bios_CD_E.bin", "e66fa1dc5820d254611fdcdba0662372", note="Europe (Mega-CD)"),
            _bios("bios_CD_J.bin", "278a9397d192149e84e820ac621a8edd", note="Japan (Mega-CD)"),
        ), required=True),
        BiosSystem("saturn", "Sega Saturn", (
            _bios("saturn_bios.bin", "af5828fdff51384f99b3c4926be27762"),
        ), required=False),
        BiosSystem("3do", "3DO Interactive Multiplayer", (
            _bios("panafz10.bin", "51f2f43ae2f3508a14d9f56597e2d3ce", note="Panasonic FZ-10"),
            _bios("panafz1.bin", "f47264dd47fe30f73ab3c010015c155b", note="Panasonic FZ-1"),
            _bios("panafz1j.bin", "a496cfdded3da562759be3561317b605", note="Panasonic FZ-1J"),
            _bios("panafz10-norsa.bin", "1477bda80dc33731a65468c1f5bcbee9", note="FZ-10, RSA patch"),
            _bios("panafz10e-anvil.bin", "a48e6746bd7edec0f40cff078f0bb19f", note="FZ-10-E Anvil"),
            _bios("panafz10e-anvil-norsa.bin", "cf11bbb5a16d7af9875cca9de9a15e09", note="FZ-10-E Anvil, RSA patch"),
            _bios("panafz1j-norsa.bin", "f6c71de7470d16abe4f71b1444883dc8", note="FZ-1J, RSA patch"),
            _bios("goldstar.bin", "8639fd5e549bd6238cfee79e3e749114", note="Goldstar GDO-101M"),
            _bios("sanyotry.bin", "35fa1a1ebaaeea286dc5cd15487c13ea", note="Sanyo IMP-21J TRY"),
            _bios("panafz1-kanji.bin", "b8dc97f778a6245c58e064b0312e8281", satisfies=False,
                  note="Kanji ROM, for some Japanese games"),
            _bios("panafz1j-kanji.bin", "c23fb5d5e6bb1c240d02cf968972be37", satisfies=False,
                  note="Kanji ROM, for some Japanese games"),
            _bios("panafz10ja-anvil-kanji.bin", "428577250f43edc902ea239c50d2240d", satisfies=False,
                  note="Kanji ROM, for some Japanese games"),
        ), required=True),
        BiosSystem("atari5200", "Atari 5200", (
            _bios("5200.rom", "281f20ea4320404ec820fb7ec0693b38"),
        ), required=True),
        BiosSystem("lynx", "Atari Lynx", (
            _bios("lynxboot.img", "fcd403db69f54290b51035d82f835e7b"),
        ), required=True),
        BiosSystem("pcecd", "PC Engine CD / TurboGrafx-CD", (
            _bios("syscard3.pce", "38179df8f4ac870017db21ebcbf53114", note="Super CD-ROM2 System V3"),
            _bios("syscard2.pce", satisfies=False, note="CD-ROM System V2, optional"),
            _bios("syscard1.pce", satisfies=False, note="CD-ROM System V1, optional"),
            _bios("gexpress.pce", satisfies=False, note="Game Express CD Card, optional"),
        ), required=True),
        BiosSystem("colecovision", "ColecoVision", (
            _bios("colecovision.rom", "2c66f5911e5b42b8ebe113403548eee7"),
        ), required=True),
        BiosSystem("fds", "Famicom Disk System", (
            _bios("disksys.rom", "ca30b50f880eb660a320674ed365ef7a"),
        ), required=True),
    )
}

# Core options a core needs set to use the uploaded BIOS (EmulatorJS EJS_defaultOptions):
# Opera doesn't search for its BIOS; it loads whichever file "opera_bios" names.
BIOS_CORE_OPTION: dict[str, str] = {"3do": "opera_bios"}

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
        "a26", "a52", "a78", "lnx", "o", "j64", "jag", "abs", "cof", "rom",  # Atari
        "pce", "sgx",  # PC Engine / TurboGrafx
        "ngp", "ngc",  # Neo Geo Pocket
        "ws", "wsc",  # WonderSwan
        "col",  # ColecoVision
    }
)
_DISC_EXTENSIONS = frozenset({"iso", "cso", "chd", "cue", "bin", "img", "ccd", "m3u", "pbp", "elf"})
ARCHIVE_EXTENSION = "zip"
# Archives whose contents are inspected on upload (py7zr for 7z); EmulatorJS extracts both.
ARCHIVE_EXTENSIONS = frozenset({"zip", "7z"})

ALLOWED_UPLOAD_EXTENSIONS: dict[MediaFormat, frozenset[str]] = {
    MediaFormat.ROM: _CART_EXTENSIONS | {"bin", "iso", "cso", "chd", "pbp", "elf"} | ARCHIVE_EXTENSIONS,
    MediaFormat.ABANDONWARE: ARCHIVE_EXTENSIONS,
    MediaFormat.ISO: frozenset({"iso", "cso", "chd", "pbp"}) | ARCHIVE_EXTENSIONS,
}

# What counts as "the ROM" when looking inside an uploaded archive.
ROM_CONTENT_EXTENSIONS = _CART_EXTENSIONS | _DISC_EXTENSIONS

ROM_CAPABLE_FORMATS = frozenset(ALLOWED_UPLOAD_EXTENSIONS)


class UnplayableReason(StrEnum):
    UNSUPPORTED_PLATFORM = "unsupported_platform"
    UNSUPPORTED_FILE_TYPE = "unsupported_file_type"
    MISSING_BIOS = "missing_bios"


def core_for_platform(platform_slug: str | None) -> EmulatorCore | None:
    if platform_slug is None:
        return None
    return next((c for c in CORES if platform_slug in c.platform_slugs), None)


def resolve_playability(
    platform_slug: str | None,
    extension: str,
    is_archive: bool = False,
    ready_bios_systems: frozenset[str] = frozenset(),
) -> tuple[EmulatorCore | None, UnplayableReason | None]:
    """(core, None) when playable, else (core-or-None, why). `extension` is RomFile.extension
    — for an archive that's the detected inner file's extension, so an archive is playable
    exactly when its contents would be (or always, for cores that take whole archives).
    `ready_bios_systems` are the BIOS_SYSTEMS keys with a usable BIOS uploaded; for
    MISSING_BIOS the core is still returned so callers can say which BIOS is missing."""
    core = core_for_platform(platform_slug)
    if core is None:
        return None, UnplayableReason.UNSUPPORTED_PLATFORM
    if extension.lower() not in core.extensions and not (is_archive and core.accepts_any_archive):
        return None, UnplayableReason.UNSUPPORTED_FILE_TYPE
    if core.bios_required and core.bios_system not in ready_bios_systems:
        return core, UnplayableReason.MISSING_BIOS
    return core, None
