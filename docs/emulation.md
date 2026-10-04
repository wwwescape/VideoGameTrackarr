# In-browser play (ROMs)

Owned copies with a **ROM**, **Abandonware**, or **ISO** format get a ROM files list in the
Your Library dialog. A copy can hold several files (say, two regions or revisions), each with an
optional label, and each can be the ROM/disc image itself or a `.zip`/`.7z` of it (a disc's
`.cue` + `.bin` files, or a multi-disc set with an `.m3u`, go in one archive). When a copy's
platform and file type match a bundled emulator core, a **Play Game** button appears on the
game's page (under Resync/Remove), listing each uploaded ROM by platform and label. Each ROM
in the dialog can be replaced, downloaded back (its original file) or removed.

**Saves live on the server**, so they survive clearing your browser and follow you to another
device:

- **Save states** — the player's Save State button stores a snapshot (with a screenshot) in
  VGT, as many as you like; its Load State button opens a picker of them, and **Resume…** in
  the Play Game dialog starts the game from one. Delete old ones from either picker.
- **In-game saves** — a game's own save (the battery save a cartridge would keep) syncs to VGT
  automatically every minute and when you close the player, and is loaded back in the next
  time you play, on any browser.
- Replacing or removing a ROM deletes its saves too (only that ROM's) — they only work with
  the exact file they were made on.

- **Playable today** (zipped or not): NES/Famicom, SNES/Super Famicom, Game Boy/Color, Game
  Boy Advance, Nintendo 64, Nintendo DS, Virtual Boy, Sega Genesis/Mega Drive, Master System,
  Game Gear, 32X, Atari 2600/7800/Jaguar, PC Engine/TurboGrafx-16/SuperGrafx, Neo Geo Pocket/
  Color, WonderSwan/Color, PlayStation, and DOS (any `.zip` of the game's folder, including
  Abandonware copies). ROMs can only be uploaded for these platforms — for any other, the
  dialog shows a note instead of the upload field. **Arcade isn't included**: the only EmulatorJS arcade core (FinalBurn Neo) forbids
  use by projects that take donations.
- **BIOS systems** — Sega CD, Saturn, 3DO, PC Engine CD, Atari Lynx, Atari 5200, ColecoVision and
  Famicom Disk System need the console's own BIOS file (PlayStation and Saturn have a built-in
  fallback, but some games run better with the real one). Upload them once in **Settings →
  Emulation**, which lists the exact file names each system accepts and flags whether your
  dump matches a known-good checksum. As with ROMs, dump them from consoles you own — VGT never
  downloads or includes BIOS files.
- **DOS and PSP open in a new tab**. Their emulator cores need SharedArrayBuffer, which browsers
  only allow on a cross-origin-isolated page, so they play in a separate player page served
  with `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy` headers (set by VGT itself;
  a reverse proxy must pass them through unchanged). PSP also needs WebGL2. Saves work the same
  as in the in-page player; closing the tab directly (instead of the player's close button) can
  lose up to the last minute of in-game progress.
- **Licenses**: the SNES (Snes9x), Genesis family and Sega CD (Genesis Plus GX), 32X (PicoDrive)
  and 3DO (Opera) cores are free to redistribute but for **non-commercial use only**; every
  bundled core and its license is listed on the About page.
- **Bring your own files** — VGT never hosts, distributes, or helps find ROMs. Only upload
  games you legally own.
- **Size limit**: `ROM_MAX_UPLOAD_MB` in `.env` (default 2048). If you run VGT behind a
  reverse proxy, raise its request body limit to match — Nginx's default is only 1 MB (see
  `docs/deployment/nginx.example.conf`).
- ROMs and their saves are stored under `backend/uploads/roms/` (the same Docker volume as
  other uploads) but are never publicly served — ROMs only through short-lived signed links,
  saves only to your logged-in session. BIOS files live under `backend/uploads/roms/bios/`,
  just as private.
- **Backups**: the JSON backup leaves ROMs, saves and BIOS files out (a restore on the same
  instance keeps ROMs, and their saves, whose copy still exists). Tick **Include ROMs, saves
  and BIOS files** in Settings → Data Management to download a `.zip` full backup instead —
  as large as all your ROMs together, streamed straight to disk. Restoring that `.zip` (Restore
  accepts either) replaces ROMs, saves and BIOS files along with everything else; behind a
  reverse proxy, its request body limit applies to restores too.

EmulatorJS (GPL-3.0) and each bundled core (under its own license) are credited on the About
page. They're downloaded from the npm registry at build time — pinned and integrity-checked —
by `frontend/scripts/vendor-emulatorjs.mjs`, which runs automatically before `npm run start`
and `npm run build`.
