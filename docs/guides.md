# Guides & Cheats

Every game's page has a **Guides & Cheats** section, above Notes, for keeping walkthroughs,
maps, strategy guides and cheat-code lists with the game. Each entry is either a file you
upload or a link you save, and is marked **Guide** or **Cheat**. It can also name one platform,
which helps for cheat codes that only work on one version of a game.

## Adding one

Click **+ Add** on the section, then:

- **Type**: Guide or Cheat.
- **Source**: **File** (drop a file on the box, or **Choose file**) or **Link** (a full
  `http://` or `https://` address).
- **Name**: optional. Left empty, it's the file's name without its extension, or the link's
  site (for example `gamefaqs.gamespot.com`).
- **Platform**: optional. Platforms you have copies on come first, then the game's other
  platforms.

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

**Not accepted:**

- **HTML** (`.html`, `.htm`, `.mht`): a web page is someone else's code, and one saved from a
  browser is rarely a single file anyway. Save the page as a link instead, or print it to PDF.
- **Old Word files** (`.doc`): browsers can't show them. Save the file as `.docx` or PDF.

Files are checked by their contents, not just their name, so a renamed file is refused too. The
limit is 50 MB per file, set with `GUIDE_MAX_UPLOAD_MB` in `.env`. Behind a reverse proxy, its
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
- **Find**: the search button, or Ctrl+F (⌘F on a Mac) while the reader is open. It ignores
  case and accents, and it searches inside PDFs too. Enter goes to the next match and
  Shift+Enter to the previous one. Esc closes find, then the reader.
- **Your place**: the reader remembers where you were in each guide, in this browser, and opens
  it there next time. Replacing the file starts it from the top again.
- **Links to a guide**: while a guide is open, the address ends in `#guides/<id>`. Bookmark it
  to come straight back to that guide. Back closes the reader.
- **Open in new tab** and **Download** are in the reader's header (under **⋮** on a phone).
  Download gives back the file exactly as it was uploaded.

The PDF viewer is [pdf.js](https://mozilla.github.io/pdf.js/) (Apache-2.0), served by
VideoGameTrackarr itself. It's only downloaded the first time a PDF is opened, and isn't
stored for offline use until then.

## Where files are kept

Uploaded files are stored on your server in `uploads/guides/` (inside the app's uploads
volume), under random names. Unlike covers, that folder is never served publicly: the reader,
a new tab and a download each get a short-lived signed link, valid for an hour for reading and
ten minutes for a download. Guides never appear on share pages.

Word and Markdown files are turned into a page once, when they're uploaded, and cleaned of
anything active (scripts, styling, forms, outside images, unsafe links). The browser cleans
them once more before showing them. Images from other websites never load, so nothing tracks
you while you read. VideoGameTrackarr never visits a saved link itself.

## Backups

- **A `.json` backup** keeps every entry, links included, but not the uploaded files.
- **A `.zip` backup** also carries the files when **Guides & cheats (uploaded files)** is ticked
  under **Settings → General → Data**.
- **After restoring**, an entry whose file wasn't in the backup shows **File missing**. Click
  it, or **Edit**, to upload the file again. Restoring rebuilds the readable pages of Word and
  Markdown files from the originals.
- **Danger Zone** has **Clear guides & cheats**, which removes every entry and file. Resetting
  the library removes them too, and deleting a game deletes its guides.
