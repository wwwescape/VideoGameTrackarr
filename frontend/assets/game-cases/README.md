# Game case spine logos

Logos drawn in the logo band at the top of each case on the **Game Shelf** (a Settings → Labs feature). Drop a file here, name it in the `Logo` column of [`docs/data/game_cases/Game_Cases.csv`](../../../docs/data/game_cases/Game_Cases.csv), and rebuild. No code change is needed.

- **Format:** `.svg` if you can, since it stays sharp at every shelf scale. Otherwise `.png` or `.webp` with a transparent background, at least 400px on its long side.
- **Orientation:** exactly as it sits on a case standing on the shelf. The file is drawn as-is, never rotated, so most spine logos are a tall image. For example:
  - PS3, PSP and PS Vita: the wordmark runs down the spine (rotated 90° clockwise).
  - PS4 and PS5: the PlayStation symbol stays upright with "PS4"/"PS5" running down the spine below it. That's one image, composed that way.
  - PS1 and PS2: the logo box stays upright (PS2 adds "PlayStation 2" running down below it).
  - Switch and Switch 2: the logo stays upright in a short band.
  - Game Boy, DS and 3DS: the wordmark runs down the spine.
  - Sega (Master System, Mega Drive, Sega CD, Saturn, Dreamcast): the SEGA badge, Saturn's planet or Dreamcast's swirl stays upright at the top, with the wordmark running down the spine below it.
- **Colours:** the logo in its printed colours (e.g. white on the PS4's blue band, black on the PS5's white band). The band's background comes from the CSV's `Logo Band Color`, so don't bake a background into the file. For a one-colour spine mark, the CSV's `Logo Color` can repaint any file in that colour instead (it keeps only the file's shape), so a black wordmark shows white on a black band.
- **Size:** cropped tight. It's scaled to fit inside the band (with a small margin), so set the CSV's `Logo Band Height (%)` to match how much of the real spine the band covers.
- **Naming:** anything, as long as the CSV's `Logo` cell matches; the platform's IGDB slug is a good choice (`ps5.svg`, `switch.svg`).

Two more CSV columns shape the spine around the logo: `Case Top (mm)`, how much of the case shows above the band (a PS3 case's clear top), drawn in `Case Color`; and `Logo Line Color`, the thin line under the band (PS3 red, PS4 white, PS5 blue), blank for none.

A case with no `Logo`, or naming a file that isn't here, shows the platform's short name running down the band instead. The backend tests check that every `Logo` the CSV names is in this folder.

After changing the CSV, an existing install picks it up with `python -m scripts.import_game_cases` (from `backend/`). Your Show on shelf choices are kept.
