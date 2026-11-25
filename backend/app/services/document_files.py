"""The file side of every document table (game_documents, hardware_documents,
toys_to_life_documents): storage, validation, conversion, serving and cleanup.

An entry is either an uploaded file or a saved link. Files live in a private folder (a
DocumentStore) that the public /uploads mount refuses to serve; they're only reachable through
signed links. Files are always deleted after the database commit, so a file on disk never
outlives its row and a rolled-back transaction never leaves a row pointing at nothing.

Accepted files: PDF, Word (.docx), Markdown, plain text and images (JPG, PNG, WebP). HTML is
refused outright (it would be someone else's markup running inside the app, and saved web
pages are rarely one file anyway); Word and Markdown are converted to HTML once, on upload,
and that HTML is sanitised with an allowlist before it's stored. A restore rebuilds it from
the original rather than trusting rendered HTML from a backup. Images are re-encoded on upload
with their metadata stripped (phone photos carry GPS location), and only that copy is kept.
"""

import io
import re
import uuid
import zipfile
from collections.abc import Callable
from dataclasses import dataclass
from html import unescape as html_unescape
from pathlib import Path, PurePosixPath
from typing import BinaryIO, Protocol
from urllib.parse import urlsplit

import mammoth
import nh3
from markdown_it import MarkdownIt
from PIL import Image, ImageCms, ImageOps, UnidentifiedImageError
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.core.config import UPLOADS_DIR, get_settings
from app.models.documents import IMAGE_FORMATS, DocumentFormat, DocumentSource
from app.services import file_storage
from app.services.exceptions import ConflictError, NotFoundError

MAX_NAME_LENGTH = 200
MAX_URL_LENGTH = 2048
RENDER_HTML_SUFFIX = ".render.html"
RENDER_TEXT_SUFFIX = ".render.txt"
# A .docx is a zip; refuse one that would unpack to more than this many times the upload
# limit before mammoth opens it (a zip bomb).
DOCX_MAX_EXPANSION = 10
# An image is refused above this many pixels before it's decoded (a decompression bomb). A
# 50 MP phone photo still fits.
MAX_IMAGE_PIXELS = 50_000_000

_EXTENSION_FORMATS: dict[str, DocumentFormat] = {
    "pdf": DocumentFormat.PDF,
    "docx": DocumentFormat.DOCX,
    "md": DocumentFormat.MD,
    "markdown": DocumentFormat.MD,
    "txt": DocumentFormat.TXT,
    "jpg": DocumentFormat.JPG,
    "jpeg": DocumentFormat.JPG,
    "png": DocumentFormat.PNG,
    "webp": DocumentFormat.WEBP,
}
_HTML_EXTENSIONS = {"html", "htm", "xhtml", "mht", "mhtml"}
_HTML_LOOKALIKE_PREFIXES = ("<!doctype html", "<html", "<?xml")

HTML_REJECTED_MESSAGE = "HTML files aren't supported. Save it as PDF, or add it as a link."
DOC_REJECTED_MESSAGE = "Old Word (.doc) files aren't supported. Save it as .docx or PDF."
SVG_REJECTED_MESSAGE = "SVG images aren't supported. Export it as PNG."
HEIC_REJECTED_MESSAGE = "HEIC photos aren't supported. Export it as JPG."
UNSUPPORTED_MESSAGE = (
    "Unsupported file type. Use PDF, Word (.docx), Markdown (.md), text (.txt) or an image (JPG, PNG, WebP)."
)

# What the sanitiser keeps: document structure only. No style, class or event attributes,
# no script/iframe/form/object. Links and images are narrowed further in _attribute_filter.
_ALLOWED_TAGS = {
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "ul", "ol", "li", "dl", "dt", "dd",
    "blockquote", "pre", "code", "em", "strong", "b", "i", "u", "s", "del", "sub", "sup",
    "a", "img", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "figure",
    "figcaption", "span", "div",
}  # fmt: skip
_ALLOWED_ATTRIBUTES = {
    "a": {"href", "title", "id"},
    "img": {"src", "alt", "title", "width", "height"},
    "th": {"colspan", "rowspan"},
    "td": {"colspan", "rowspan"},
    "ol": {"start"},
    **{tag: {"id"} for tag in ("h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "span", "div")},
}
# Ids in a converted document (a Word table of contents, footnotes) are prefixed so they
# can't clash with the app's own; in-document links are rewritten to match.
_ID_PREFIX = "guide-"
_DATA_IMAGE = re.compile(r"data:image/(png|jpeg|gif|webp);base64,", re.IGNORECASE)

_markdown = MarkdownIt("commonmark", {"html": False}).enable(["table", "strikethrough"])


class DocumentValidationError(ValueError):
    """The upload or link itself is unacceptable (type, content, URL) — 400."""


class DocumentTooLargeError(ValueError):
    """The upload exceeds GUIDE_MAX_UPLOAD_MB (shared by every document) — 413."""


class DocumentEntry(Protocol):
    """The columns every document table shares (app.models.documents.DocumentColumnsMixin)."""

    name: str
    source: DocumentSource
    url: str | None
    original_filename: str | None
    stored_filename: str | None
    rendered_filename: str | None
    media_format: DocumentFormat | None
    size_bytes: int | None


def max_upload_bytes() -> int:
    return get_settings().guide_max_upload_mb * 1024 * 1024


def _extension_of(filename: str) -> str:
    return PurePosixPath(filename.replace("\\", "/")).suffix.removeprefix(".").lower()


def accepted_extensions() -> list[str]:
    return list(_EXTENSION_FORMATS)


def format_for_filename(filename: str) -> DocumentFormat:
    extension = _extension_of(filename)
    if extension in _HTML_EXTENSIONS:
        raise DocumentValidationError(HTML_REJECTED_MESSAGE)
    if extension == "doc":
        raise DocumentValidationError(DOC_REJECTED_MESSAGE)
    if extension in ("svg", "svgz"):
        raise DocumentValidationError(SVG_REJECTED_MESSAGE)
    if extension in ("heic", "heif"):
        raise DocumentValidationError(HEIC_REJECTED_MESSAGE)
    media_format = _EXTENSION_FORMATS.get(extension)
    if media_format is None:
        raise DocumentValidationError(UNSUPPORTED_MESSAGE)
    return media_format


# --- Content checks and conversion ---------------------------------------------------------


def _attribute_filter(tag: str, attribute: str, value: str) -> str | None:
    if tag == "a" and attribute == "href":
        if value.lower().startswith(("http://", "https://")):
            return value
        if value.startswith("#") and len(value) > 1:
            return f"#{_ID_PREFIX}{value[1:]}"
        return None
    if tag == "img" and attribute == "src":
        return value if _DATA_IMAGE.match(value) else None
    return value


def sanitize_html(html: str) -> str:
    """Allowlist-sanitises converted Word/Markdown HTML (nh3, i.e. Rust's ammonia): document
    tags only; links only to http(s) or within the document; images only as embedded data
    (never fetched from elsewhere, so nothing tracks the reader); every link gets
    rel="noopener noreferrer". The reader decides how links open."""
    return nh3.clean(
        html,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRIBUTES,
        attribute_filter=_attribute_filter,
        url_schemes={"http", "https", "data"},
        link_rel="noopener noreferrer",
        id_prefix=_ID_PREFIX,
        strip_comments=True,
    )


def _decode_text(raw: bytes) -> tuple[str, bool]:
    """(text, was_utf8). UTF-8 (with or without a BOM) first, then Windows-1252, which most
    older GameFAQs files use. Binary data (any NUL byte, or bytes neither decodes) fails."""
    if b"\x00" in raw:
        raise DocumentValidationError("This doesn't look like a text file")
    try:
        return raw.decode("utf-8-sig"), True
    except UnicodeDecodeError:
        pass
    try:
        return raw.decode("cp1252"), False
    except UnicodeDecodeError as exc:
        raise DocumentValidationError("This doesn't look like a text file") from exc


def _refuse_html_lookalike(text: str) -> None:
    head = text[:1024].lstrip().lower()
    if head.startswith(_HTML_LOOKALIKE_PREFIXES):
        raise DocumentValidationError(HTML_REJECTED_MESSAGE)


def _check_pdf(path: Path) -> None:
    with path.open("rb") as handle:
        head = handle.read(1024)
    if b"%PDF-" not in head:
        raise DocumentValidationError("This isn't a valid PDF file")


def _convert_docx(path: Path) -> str:
    try:
        with zipfile.ZipFile(path) as archive:
            names = set(archive.namelist())
            if "word/document.xml" not in names or "[Content_Types].xml" not in names:
                raise DocumentValidationError("This isn't a valid Word (.docx) file")
            if sum(info.file_size for info in archive.infolist()) > DOCX_MAX_EXPANSION * max_upload_bytes():
                raise DocumentValidationError("This Word file is too large once unpacked")
    except zipfile.BadZipFile as exc:
        raise DocumentValidationError("This isn't a valid Word (.docx) file") from exc
    try:
        with path.open("rb") as handle:
            result = mammoth.convert_to_html(handle)
    except Exception as exc:  # mammoth raises a variety of parse errors for damaged files
        raise DocumentValidationError("Couldn't read this Word file") from exc
    return sanitize_html(result.value)


_HEADING = re.compile(r"<h([1-6])>(.*?)</h\1>", re.DOTALL)
_TAG = re.compile(r"<[^>]+>")


def _heading_slug(inner_html: str) -> str:
    """GitHub's heading anchors: lowercased text, spaces to hyphens, punctuation dropped."""
    text = html_unescape(_TAG.sub("", inner_html)).strip().lower()
    return re.sub(r"[^\w\- ]", "", text).replace(" ", "-")


def _add_heading_ids(html: str) -> str:
    """Gives Markdown headings GitHub-style ids, so a guide's `[see below](#castle)` links have
    somewhere to go (the sanitiser then prefixes both the ids and the links with `guide-`).
    A repeated heading gets -1, -2, … as on GitHub."""
    seen: dict[str, int] = {}

    def add_id(match: re.Match[str]) -> str:
        level, inner = match.group(1), match.group(2)
        slug = _heading_slug(inner)
        if not slug:
            return match.group(0)
        count = seen.get(slug, 0)
        seen[slug] = count + 1
        anchor = slug if count == 0 else f"{slug}-{count}"
        return f'<h{level} id="{anchor}">{inner}</h{level}>'

    return _HEADING.sub(add_id, html)


def render_markdown(text: str) -> str:
    return sanitize_html(_add_heading_ids(_markdown.render(text)))


# --- Images --------------------------------------------------------------------------------

_IMAGE_SIGNATURES: dict[DocumentFormat, tuple[str, Callable[[bytes], bool]]] = {
    DocumentFormat.JPG: ("JPEG", lambda head: head.startswith(b"\xff\xd8\xff")),
    DocumentFormat.PNG: ("PNG", lambda head: head.startswith(b"\x89PNG\r\n\x1a\n")),
    DocumentFormat.WEBP: ("WEBP", lambda head: head[:4] == b"RIFF" and head[8:12] == b"WEBP"),
}
_SRGB = ImageCms.createProfile("sRGB")


def _to_srgb(image: Image.Image) -> Image.Image:
    """Converts an image with an embedded colour profile to sRGB, so it looks the same once
    the profile is stripped. One Pillow can't convert keeps its pixels as they are."""
    icc = image.info.get("icc_profile")
    if not icc or image.mode not in ("RGB", "RGBA", "CMYK", "L"):
        return image
    try:
        output_mode = "RGBA" if image.mode == "RGBA" else "RGB"
        converted = ImageCms.profileToProfile(image, io.BytesIO(icc), _SRGB, outputMode=output_mode)
        return converted or image
    except (ImageCms.PyCMSError, OSError, ValueError):
        return image


def clean_image(path: Path, media_format: DocumentFormat) -> int:
    """Checks an uploaded image is really the format its name says, then re-encodes it in
    place with the orientation applied and every bit of metadata (EXIF and its GPS location,
    XMP, colour profile, text chunks) dropped. Returns the new size. Raises
    DocumentValidationError; the caller removes the file."""
    pil_format, signature_ok = _IMAGE_SIGNATURES[media_format]
    with path.open("rb") as handle:
        head = handle.read(16)
    if not signature_ok(head):
        raise DocumentValidationError(f"This isn't a valid {media_format.value.upper()} image")
    try:
        with Image.open(path) as probe:
            if probe.format != pil_format:
                raise DocumentValidationError(f"This isn't a valid {media_format.value.upper()} image")
            width, height = probe.size
            if width * height > MAX_IMAGE_PIXELS:
                raise DocumentValidationError("This image is too large (over 50 megapixels)")
            if getattr(probe, "n_frames", 1) > 1:
                raise DocumentValidationError("Animated images aren't supported")
            probe.verify()
        with Image.open(path) as source:
            source.load()
            image = ImageOps.exif_transpose(source) or source
            image = _to_srgb(image)
            if media_format is DocumentFormat.JPG:
                if image.mode != "RGB" and image.mode != "L":
                    image = image.convert("RGB")
            elif image.mode == "P":
                image = image.convert("RGBA" if "transparency" in image.info else "RGB")
            elif image.mode not in ("RGB", "RGBA", "L", "LA", "I;16", "I"):
                image = image.convert("RGBA")
            # Everything Pillow would otherwise carry over (exif, icc_profile, xmp, PNG text).
            image.info = {}
            buffer = io.BytesIO()
            if media_format is DocumentFormat.JPG:
                image.save(buffer, "JPEG", quality=90, optimize=True)
            elif media_format is DocumentFormat.PNG:
                image.save(buffer, "PNG", optimize=True)
            else:
                image.save(buffer, "WEBP", quality=90)
    except DocumentValidationError:
        raise
    except Image.DecompressionBombError as exc:
        raise DocumentValidationError("This image is too large (over 50 megapixels)") from exc
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise DocumentValidationError(f"This isn't a valid {media_format.value.upper()} image") from exc
    data = buffer.getvalue()
    path.write_bytes(data)
    return len(data)


# --- Storage -------------------------------------------------------------------------------


@dataclass
class StoredUpload:
    original_filename: str
    stored_filename: str
    rendered_filename: str | None
    media_format: DocumentFormat
    size_bytes: int

    def filenames(self) -> list[str]:
        return [name for name in (self.stored_filename, self.rendered_filename) if name]


@dataclass
class ServedFile:
    path: Path
    media_type: str
    # "html" (a rendered page), "pdf", "text", "image" or "download": decides the content
    # route's policy.
    kind: str
    download_name: str | None = None


_DOWNLOAD_MEDIA_TYPES = {
    DocumentFormat.PDF: "application/pdf",
    DocumentFormat.DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    DocumentFormat.MD: "text/markdown; charset=utf-8",
    DocumentFormat.TXT: "text/plain; charset=utf-8",
    DocumentFormat.JPG: "image/jpeg",
    DocumentFormat.PNG: "image/png",
    DocumentFormat.WEBP: "image/webp",
}

_STORES: list["DocumentStore"] = []


class DocumentStore:
    """One private folder of document files. `directory` is an attribute (not a method) so
    tests and scratch runs can point a store elsewhere."""

    def __init__(self, subdir: str, override_setting: str, noun: str) -> None:
        self.subdir = subdir
        self._override_setting = override_setting
        self.noun = noun
        self._pending_key = f"{subdir}_files_to_delete"
        _STORES.append(self)

    def directory(self) -> Path:
        override = getattr(get_settings(), self._override_setting)
        return Path(override) if override else UPLOADS_DIR / self.subdir

    def safe_path(self, stored_filename: str) -> Path:
        """stored_filename is always one we generated, but resolve and confirm it anyway."""
        folder = self.directory().resolve()
        candidate = (folder / stored_filename).resolve()
        if not candidate.is_relative_to(folder) or candidate == folder:
            raise DocumentValidationError(f"Invalid {self.noun} path")
        return candidate

    def delete_files(self, stored_filenames: list[str]) -> None:
        for stored_filename in stored_filenames:
            try:
                self.safe_path(stored_filename).unlink(missing_ok=True)
            except (OSError, DocumentValidationError):
                pass

    def delete_files_after_commit(self, db: Session, stored_filenames: list[str]) -> None:
        """For bulk deletes of document rows (deleting games or hardware, Danger Zone): the
        files are removed once the session's transaction commits, and kept if it rolls back —
        so every path that deletes owners cleans up without each caller having to."""
        if stored_filenames:
            db.info.setdefault(self._pending_key, []).extend(stored_filenames)

    def clear_folder(self, keep: set[str] | None = None) -> None:
        """Removes every file in the folder except `keep` — after a Danger Zone clear or reset
        (keep nothing), or a restore without files (keep the ones whose rows survived)."""
        folder = self.directory()
        if not folder.is_dir():
            return
        keep = keep or set()
        for entry in folder.iterdir():
            if entry.is_file() and entry.name not in keep:
                entry.unlink(missing_ok=True)

    # --- Uploads ---

    def _build_rendered(self, stored_filename: str, media_format: DocumentFormat) -> str | None:
        """Checks the stored original's content and writes its rendered copy, if it needs one.
        Returns the rendered copy's file name (or None). Raises DocumentValidationError,
        leaving any rendered copy it started removed; the caller removes the original."""
        path = self.safe_path(stored_filename)
        stem = stored_filename.rsplit(".", 1)[0]
        if media_format is DocumentFormat.PDF:
            _check_pdf(path)
            return None
        if media_format in IMAGE_FORMATS:
            return None
        if media_format is DocumentFormat.DOCX:
            html = _convert_docx(path)
            rendered = stem + RENDER_HTML_SUFFIX
            self.safe_path(rendered).write_text(html, encoding="utf-8")
            return rendered
        text, was_utf8 = _decode_text(path.read_bytes())
        _refuse_html_lookalike(text)
        if media_format is DocumentFormat.MD:
            rendered = stem + RENDER_HTML_SUFFIX
            self.safe_path(rendered).write_text(render_markdown(text), encoding="utf-8")
            return rendered
        if was_utf8:
            return None
        rendered = stem + RENDER_TEXT_SUFFIX
        self.safe_path(rendered).write_text(text, encoding="utf-8")
        return rendered

    def store_upload(self, source: BinaryIO, original_filename: str) -> StoredUpload:
        original_filename = PurePosixPath(original_filename.replace("\\", "/")).name.strip()
        if not original_filename:
            raise DocumentValidationError("The file has no name")
        media_format = format_for_filename(original_filename)
        extension = "jpg" if media_format is DocumentFormat.JPG else _extension_of(original_filename)
        stored_filename = f"{uuid.uuid4().hex}.{extension}"
        limit_mb = get_settings().guide_max_upload_mb
        size = file_storage.stream_to_path(
            source,
            self.safe_path(stored_filename),
            max_upload_bytes(),
            too_large=lambda: DocumentTooLargeError(f"The file is larger than {limit_mb} MB"),
            empty=lambda: DocumentValidationError("The file is empty"),
        )
        try:
            if media_format in IMAGE_FORMATS:
                size = clean_image(self.safe_path(stored_filename), media_format)
            rendered_filename = self._build_rendered(stored_filename, media_format)
        except BaseException:
            stem = stored_filename.rsplit(".", 1)[0]
            self.delete_files([stored_filename, stem + RENDER_HTML_SUFFIX, stem + RENDER_TEXT_SUFFIX])
            raise
        return StoredUpload(original_filename[:255], stored_filename, rendered_filename, media_format, size)

    def rebuild_rendered(self, entry: DocumentEntry) -> None:
        """After a restore extracts an entry's original: rebuild its rendered copy from it, so
        the HTML a reader sees is always one this server sanitised. An original that no longer
        passes the checks (a hand-edited backup) keeps its row but gets no rendered copy."""
        entry.rendered_filename = None
        if entry.source is not DocumentSource.FILE or not entry.stored_filename or entry.media_format is None:
            return
        if not self.safe_path(entry.stored_filename).is_file():
            return
        try:
            entry.rendered_filename = self._build_rendered(entry.stored_filename, entry.media_format)
        except DocumentValidationError:
            entry.rendered_filename = None

    # --- Entries ---

    def file_missing(self, entry: DocumentEntry) -> bool:
        if entry.source is not DocumentSource.FILE or not entry.stored_filename:
            return False
        try:
            return not self.safe_path(entry.stored_filename).is_file()
        except DocumentValidationError:
            return True

    def commit_or_discard(self, db: Session, new_files: list[str]) -> None:
        try:
            db.commit()
        except BaseException:
            db.rollback()
            self.delete_files(new_files)
            raise

    def create_file_entry(
        self, db: Session, entry: DocumentEntry, source: BinaryIO, original_filename: str, name: str | None
    ) -> None:
        """Stores the upload, fills in `entry`'s file columns and name, adds and commits it."""
        stored = self.store_upload(source, original_filename)
        set_file_columns(entry, stored)
        entry.name = clean_name(name, name_from_filename(stored.original_filename))
        db.add(entry)
        self.commit_or_discard(db, stored.filenames())
        db.refresh(entry)

    def apply_changes(self, entry: DocumentEntry, changes: dict) -> list[str]:
        """The PATCH fields every table shares: `name`, `kind` and `url` (setting `url` on a
        file entry turns it into a link). Returns the files to delete once the change
        commits."""
        old_files: list[str] = []
        if changes.get("kind") is not None:
            entry.kind = changes["kind"]
        if "url" in changes:
            if changes["url"] is None:
                raise DocumentValidationError("Enter a link")
            entry.url = validate_url(changes["url"])
            if entry.source is DocumentSource.FILE:
                old_files = filenames_of(entry)
                clear_file_columns(entry)
                entry.source = DocumentSource.LINK
        if "name" in changes:
            fallback = (
                name_from_filename(entry.original_filename or "")
                if entry.source is DocumentSource.FILE
                else (domain_of(entry.url) or "")
            )
            entry.name = clean_name(changes["name"], fallback)
        return old_files

    def replace_file(self, db: Session, entry: DocumentEntry, source: BinaryIO, original_filename: str) -> None:
        """Swaps in a new file — on a file entry, or turning a link into a file. The new file
        is written and checked first, so a refused upload leaves the entry as it was."""
        stored = self.store_upload(source, original_filename)
        old_files = filenames_of(entry)
        set_file_columns(entry, stored)
        self.commit_or_discard(db, stored.filenames())
        db.refresh(entry)
        self.delete_files(old_files)

    def delete_entry(self, db: Session, entry: DocumentEntry) -> None:
        files = filenames_of(entry)
        db.delete(entry)
        db.commit()
        self.delete_files(files)

    # --- Serving ---

    def _require_file(self, entry: DocumentEntry) -> None:
        if entry.source is not DocumentSource.FILE:
            raise ConflictError("This entry is a link, not a file")
        if self.file_missing(entry):
            raise NotFoundError(f"This {self.noun}'s file is missing")

    def view_file(self, entry: DocumentEntry) -> ServedFile:
        """What the reader shows: the rendered HTML (Word/Markdown), the UTF-8 copy of a
        non-UTF-8 text file, or the original (PDF, image, UTF-8 text)."""
        self._require_file(entry)
        if entry.media_format in (DocumentFormat.DOCX, DocumentFormat.MD):
            if not entry.rendered_filename or not self.safe_path(entry.rendered_filename).is_file():
                raise NotFoundError(f"This {self.noun}'s file is missing")
            return ServedFile(self.safe_path(entry.rendered_filename), "text/html; charset=utf-8", "html")
        if entry.media_format is DocumentFormat.PDF:
            return ServedFile(self.safe_path(entry.stored_filename), "application/pdf", "pdf")
        if entry.media_format in IMAGE_FORMATS:
            return ServedFile(self.safe_path(entry.stored_filename), _DOWNLOAD_MEDIA_TYPES[entry.media_format], "image")
        name = entry.rendered_filename or entry.stored_filename
        return ServedFile(self.safe_path(name), "text/plain; charset=utf-8", "text")

    def download_file(self, entry: DocumentEntry) -> ServedFile:
        self._require_file(entry)
        media_type = _DOWNLOAD_MEDIA_TYPES.get(entry.media_format, "application/octet-stream")
        if entry.media_format is DocumentFormat.TXT and entry.rendered_filename:
            # The original isn't UTF-8 (it was read as Windows-1252): hand it back byte for byte.
            media_type = "text/plain; charset=windows-1252"
        return ServedFile(
            self.safe_path(entry.stored_filename),
            media_type,
            "download",
            download_name=entry.original_filename or entry.stored_filename,
        )


# Guides & Cheats (game_documents) keep their own folder, as before.
GUIDE_STORE = DocumentStore("guides", "guide_storage_dir", "guide")
# Devices, accessories and Toys-to-Life packs share one folder: every file is named by a
# fresh UUID, so the two tables can't collide.
HARDWARE_STORE = DocumentStore("documents", "document_storage_dir", "document")


@event.listens_for(Session, "after_commit")
def _delete_pending_files(session: Session) -> None:
    for store in _STORES:
        pending = session.info.pop(store._pending_key, None)
        if pending:
            store.delete_files(pending)


@event.listens_for(Session, "after_rollback")
def _forget_pending_files(session: Session) -> None:
    for store in _STORES:
        session.info.pop(store._pending_key, None)


# --- Entry helpers -------------------------------------------------------------------------


def filenames_of(entry: DocumentEntry) -> list[str]:
    return [name for name in (entry.stored_filename, entry.rendered_filename) if name]


def set_file_columns(entry: DocumentEntry, stored: StoredUpload) -> None:
    entry.source = DocumentSource.FILE
    entry.url = None
    entry.original_filename = stored.original_filename
    entry.stored_filename = stored.stored_filename
    entry.rendered_filename = stored.rendered_filename
    entry.media_format = stored.media_format
    entry.size_bytes = stored.size_bytes


def clear_file_columns(entry: DocumentEntry) -> None:
    entry.original_filename = None
    entry.stored_filename = None
    entry.rendered_filename = None
    entry.media_format = None
    entry.size_bytes = None


def set_link_columns(entry: DocumentEntry, url: str, name: str | None) -> None:
    """Validates `url` and makes `entry` a link to it, named `name` or after its host."""
    url = validate_url(url)
    entry.source = DocumentSource.LINK
    entry.url = url
    entry.name = clean_name(name, domain_of(url) or url)


def clean_name(name: str | None, fallback: str) -> str:
    cleaned = (name or "").strip() or fallback.strip() or "Untitled"
    return cleaned[:MAX_NAME_LENGTH]


def name_from_filename(filename: str) -> str:
    base = PurePosixPath(filename.replace("\\", "/")).name
    return base.rsplit(".", 1)[0] if "." in base else base


# --- Links ---------------------------------------------------------------------------------


def validate_url(url: str) -> str:
    url = url.strip()
    if not url:
        raise DocumentValidationError("Enter a link")
    if len(url) > MAX_URL_LENGTH:
        raise DocumentValidationError(f"The link is longer than {MAX_URL_LENGTH} characters")
    if any(ch.isspace() or ord(ch) < 32 for ch in url):
        raise DocumentValidationError("The link can't contain spaces")
    try:
        parts = urlsplit(url)
        hostname = parts.hostname
    except ValueError as exc:
        raise DocumentValidationError("That isn't a valid link") from exc
    if parts.scheme.lower() not in ("http", "https") or not hostname:
        raise DocumentValidationError("Only http and https links are supported")
    if parts.username is not None or parts.password is not None:
        raise DocumentValidationError("Links can't contain a username or password")
    return url


def reference_manual_url(value: str | None, context: str) -> str | None:
    """A curated CSV's "Manual URL" cell, checked like any link: blank or invalid is None
    (an invalid one is reported, so the CSV gets fixed, but doesn't stop the import)."""
    text = (value or "").strip()
    if not text:
        return None
    try:
        return validate_url(text)
    except DocumentValidationError as exc:
        print(f"Warning: {context}: ignoring Manual URL {text!r} ({exc})")
        return None


def domain_of(url: str | None) -> str | None:
    if not url:
        return None
    try:
        hostname = urlsplit(url).hostname
    except ValueError:
        return None
    if not hostname:
        return None
    return hostname.removeprefix("www.")
