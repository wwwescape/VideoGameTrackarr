# GOG Sync and offline installers

**Settings → GOG Sync** lists every game your GOG account owns or has wishlisted, matched to
IGDB, the same way Steam Sync does for Steam. Nothing is added to your collection until you
**Sync** a row: an owned game becomes an owned **PC, Digital, GOG** copy, and a wishlisted one
goes on your Wishlist. GOG doesn't share playtime, so there's no playtime to bring over.

## Connecting your GOG account

GOG has no API keys, so VGT signs in to your account the same way other GOG apps do (Heroic,
Minigalaxy, lgogdownloader):

1. Open **Settings → Integrations → GOG** and click **Sign in to GOG**. GOG's sign-in opens in
   a popup.
2. Sign in. GOG then shows a mostly blank page.
3. Copy that page's whole address from the address bar and paste it into the field in VGT.
   VGT connects straight away and closes the popup.

Each address works only once. If connecting fails, sign in again and paste the new one.
**Disconnect** forgets the sign-in; your GOG Sync list, ignores and links stay.

Then click **Run Import** on the GOG Sync page. The import fetches your library and wishlist
and matches them to IGDB; it never changes your collection on its own.

## Offline installers

For a game in your collection as a GOG copy that GOG Sync matched, **Offline installers**
(the download icon on its GOG Sync row, or on the GOG copy on the game's page) lists GOG's
DRM-free installers for the game and its DLC, by operating system and language.

- **Download to server** downloads an installer, all its parts (the `.exe` and any `.bin`
  files), to this server, one file at a time. You can close the page; progress shows on the
  GOG Sync page.
- **Save to device** saves a finished file from the server to whatever device you're using.
- **Installers on this server**, under the GOG Sync table, lists every download with its
  progress and the space they use, and lets you retry, cancel, save or delete each one.

Downloads are stored in `backend/uploads/gog-installers/` (the same Docker volume as other
uploads). They are never publicly served (only through short-lived signed links for your
signed-in session) and never included in backups. They are deleted when the game, or its
last GOG copy, is removed, when the library is reset, and when a backup is restored.

## Please note

- **Your own account, for your own backups.** Installers are licensed to your GOG account.
  Only connect your own account, and never share the files.
- **Unofficial sign-in.** GOG doesn't offer a public API for this. VGT uses the GOG Galaxy
  client's sign-in, like other third-party GOG apps, so GOG could change or block it at any
  time.
- **The sign-in token is stored on the server.** It's kept in VGT's database as plain text,
  never sent to the browser and never included in backups. Treat the database (and any copy
  of it) as sensitive, and use **Disconnect** if you stop using GOG Sync.
- Behind a reverse proxy, long downloads to your device can hit its timeouts; raise them if
  large installers stop part-way.
