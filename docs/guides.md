# Guides & Cheats, Manuals & Documents

Every game's page has a **Guides & Cheats** section, above Notes, for keeping walkthroughs,
maps, strategy guides, cheat-code lists, manuals and receipts with the game. Devices,
accessories and Toys to Life packs have the same kind of section, **Manuals & Documents**, for
manuals, quick-start sheets, receipts, warranty cards and repair guides. Each entry is either a
file you upload or a link you save, and has a type:

| Where | Types |
| --- | --- |
| Games | Guide, Cheat, Manual, Receipt, Other |
| Devices and accessories | Manual, Quick start, Receipt, Warranty, Repair & mods, Other |
| Toys to Life packs | Manual (the building instructions), Receipt, Other |

An entry can also name one of **your copies** (a receipt or warranty is usually for one copy:
a game copy is shown by its platform and format, hardware by its serial number or condition).
Deleting that copy keeps the entry and only forgets which copy it was. A game's entries can also
name one platform, which helps for cheat codes that only work on one version of a game.

## Official manuals

Where the curated hardware list knows the manufacturer's own manual page (Nintendo,
PlayStation and Xbox support pages, for example), a device's or accessory's section offers
**Add official manual**. A LEGO Dimensions pack offers LEGO's building instructions the same way.
One click saves it as a Manual link; the offer goes away once that link is there.

## Adding one

Click **+ Add** on the section, then:

- **Type**: one of the types above.
- **Source**: **File** (drop a file on the box, or **Choose file**) or **Link** (a full
  `http://` or `https://` address).
- **Name**: optional. Left empty, it's the file's name without its extension, or the link's
  site (for example `gamefaqs.gamespot.com`).
- **Platform** (games only): optional. Platforms you have copies on come first, then the
  game's other platforms.
- **Copy**: optional, shown when you have copies: the copy it's for.

Uploads show their progress and can be cancelled. **Edit** on a row changes any of this,
replaces the file, or switches an entry between a file and a link. Switching a file to a link
asks first, because it deletes the uploaded file. **Delete** asks first too.

## Accepted files

| Format   | Files              | Opens as                                                                                           |
| -------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| PDF      | `.pdf`             | Pages, in the reader's PDF viewer                                                                  |
| Word     | `.docx`            | A readable page (converted when you upload it; Download gives back the original)                   |
| Markdown | `.md`, `.markdown` | A readable page                                                                                    |
| Text     | `.txt`             | Monospace text, spacing kept: the classic GameFAQs format, including older files that aren't UTF-8 |
| Image    | `.jpg`, `.jpeg`, `.png`, `.webp` | The picture, fitted to the window, with zoom (a photo of a receipt, a scanned card, a map) |

**Photos are cleaned when you upload them**: they're turned the right way up and saved again
without their metadata, so a phone photo's location, camera details and the like are never
kept. Only that cleaned copy is stored, and it's what Download gives back.

**Not accepted:**

- **HTML** (`.html`, `.htm`, `.mht`): a web page is someone else's code, and one saved from a
  browser is rarely a single file anyway. Save the page as a link instead, or print it to PDF.
- **Old Word files** (`.doc`): browsers can't show them. Save the file as `.docx` or PDF.
- **SVG images**: they can carry scripts. Export the image as PNG.
- **HEIC photos** (an iPhone's default): most browsers can't show them. Export the photo as
  JPG, or set the camera to "Most Compatible".
- **Animated images**, and images over 50 megapixels.
- **Firmware and other programs**: save the download page as a link instead.

Files are checked by their contents, not just their name, so a renamed file is refused too. The
limit is 50 MB per file, for every section, set with `GUIDE_MAX_UPLOAD_MB` in `.env`. Behind a reverse proxy, its
own upload limit must allow it: Nginx's default is 1 MB (see
[deployment/nginx.example.conf](deployment/nginx.example.conf)).

## The reader

Clicking a file opens it in a full-screen reader inside the app. A link opens its site in a
new tab instead: most sites refuse to be shown inside another one.

- **PDFs**: continuous scrolling, a page box you can type a page number into, zoom (25–400%),
  **Fit width** and **Fit page**. Links inside the PDF (such as a table of contents) jump within
  it; links to websites open in a new tab.
- **Word and Markdown**: a reading column in the app's own fonts and colours, so it follows
  light and dark mode. Links within the document scroll to their place; other links open in a
  new tab.
- **Text**: **Wrap lines** on or off (on by default on narrow screens), and smaller or larger
  text. Both choices are remembered.
- **Images**: fitted to the window to start with; zoom in and out, **Fit page**, or **Actual
  size**, then scroll around.
- **Find**: the search button, or Ctrl+F (⌘F on a Mac) while the reader is open. It ignores
  case and accents, and it searches inside PDFs too (not in images). Enter goes to the next match and
  Shift+Enter to the previous one. Esc closes find, then the reader.
- **Your place**: the reader remembers where you were in each guide, in this browser, and opens
  it there next time. Replacing the file starts it from the top again.
- **Links to a guide**: while a guide is open, the address ends in `#guides/<id>`
  (`#documents/<id>` on hardware and pack pages). Bookmark it to come straight back to it.
  Back closes the reader.
- **Open in new tab** and **Download** are in the reader's header (under **⋮** on a phone).
  Download gives back the file exactly as it was uploaded.

The PDF viewer is [pdf.js](https://mozilla.github.io/pdf.js/) (Apache-2.0), served by
VideoGameTrackarr itself. It's only downloaded the first time a PDF is opened, and isn't
stored for offline use until then.

## Where files are kept

Uploaded files are stored on your server in `uploads/guides/` (games) and `uploads/documents/`
(devices, accessories and Toys to Life packs), inside the app's uploads volume, under random
names. Unlike covers, those folders are never served publicly: the reader, a new tab and a
download each get a short-lived signed link, valid for an hour for reading and ten minutes for a
download. Guides and documents never appear on share pages.

Word and Markdown files are turned into a page once, when they're uploaded, and cleaned of
anything active (scripts, styling, forms, outside images, unsafe links). The browser cleans
them once more before showing them. Images from other websites never load, so nothing tracks
you while you read. VideoGameTrackarr never visits a saved link itself.

## Backups

- **A `.json` backup** keeps every entry, links included, but not the uploaded files.
- **A `.zip` backup** also carries the files when **Guides & cheats (uploaded files)** and
  **Manuals & documents (uploaded files)** are ticked under **Settings → General → Data**.
- **After restoring**, an entry whose file wasn't in the backup shows **File missing**. Click
  it, or **Edit**, to upload the file again. Restoring rebuilds the readable pages of Word and
  Markdown files from the originals.
- **Danger Zone** has **Clear guides & cheats** (every game's entries and files) and **Clear
  manuals & documents** (every device's, accessory's and pack's). Resetting the library or the
  hardware removes them too, and deleting a game, device or accessory deletes its entries.
