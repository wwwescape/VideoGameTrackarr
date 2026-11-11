# Platform logos

Logos shown on **Games → Platforms** and in **Settings → Game Cases**. Drop a file here named after the platform's IGDB slug and rebuild; no code change is needed.

- Name: `<slug>.png`, e.g. `ps5.png`, `switch.png`, `n64.png`.
- Format: PNG only, on a 600×200 transparent canvas (3:1), the logo trimmed, fitted inside a 10px margin and centred. Cards draw it at most 56px tall, so every logo fills the same box. Save it as a palette PNG when that looks identical, otherwise a regular optimized PNG.
- Dark theme: when parts of a logo are black or dark grey and would vanish on the dark theme, add `<slug>-dark.png` beside it: the same logo with only those parts turned white, coloured marks left as they are. Dark mode uses it, and falls back to `<slug>.png` when there's none.
- Slugs ignore IGDB's `--N` suffix, so `ps4.png` also covers a platform stored as `ps4--1`.
- A platform's slug is in the address of its page: `/games/platforms/<slug>`.

Platforms without a logo show their short name (e.g. "PS5") instead.
