"""Guides & Cheats: guides and cheat sheets kept with a game — storage, validation,
conversion and cleanup.

An entry is either an uploaded file or a saved link. Files live in a private folder (see
get_guide_dir) that the public /uploads mount refuses to serve; they're only reachable
through the signed links in app/api/routes/guides.py. Every path that removes a GameGuide
row goes through a function here or through game_repository._delete_games, whose caller
removes the files once its transaction commits — so a file on disk never outlives its row.

Accepted files: PDF, Word (.docx), Markdown and plain text. HTML is refused outright (it
would be someone else's markup running inside the app, and saved web pages are rarely one
file anyway); Word and Markdown are converted to HTML once, on upload, and that HTML is
sanitised with an allowlist before it's stored. A restore rebuilds it from the original
rather than trusting rendered HTML from a backup.
"""

import re
import uuid
import zipfile
from dataclasses import dataclass
from html import unescape as html_unescape
from pathlib import Path, PurePosixPath
from typing import BinaryIO
from urllib.parse import urlsplit

import mammoth
import nh3
from markdown_it import MarkdownIt
from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app.core.config import UPLOADS_DIR, get_settings
from app.models.catalog import Game, Platform
from app.models.library import GameGuide, GuideFormat, GuideKind, GuideSource
from app.services import file_storage
from app.services.exceptions import ConflictError, NotFoundError

GUIDES_SUBDIR = "guides"
MAX_NAME_LENGTH = 200
MAX_URL_LENGTH = 2048
RENDER_HTML_SUFFIX = ".render.html"
RENDER_TEXT_SUFFIX = ".render.txt"
# A .docx is a zip; refuse one that would unpack to more than this many times the upload
# limit before mammoth opens it (a zip bomb).
DOCX_MAX_EXPANSION = 10

_EXTENSION_FORMATS: dict[str, GuideFormat] = {
    "pdf": GuideFormat.PDF,
    "docx": GuideFormat.DOCX,
    "md": GuideFormat.MD,
    "markdown": GuideFormat.MD,
    "txt": GuideFormat.TXT,
}
_HTML_EXTENSIONS = {"html", "htm", "xhtml", "mht", "mhtml"}
_HTML_LOOKALIKE_PREFIXES = ("<!doctype html", "<html", "<?xml")

HTML_REJECTED_MESSAGE = "HTML files aren't supported. Save it as PDF, or add it as a link."
DOC_REJECTED_MESSAGE = "Old Word (.doc) files aren't supported. Save it as .docx or PDF."
UNSUPPORTED_MESSAGE = "Unsupported file type. Use PDF, Word (.docx), Markdown (.md) or text (.txt)."

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


class GuideValidationError(ValueError):
    """The upload or link itself is unacceptable (type, content, URL) — 400."""


class GuideTooLargeError(ValueError):
    """The upload exceeds GUIDE_MAX_UPLOAD_MB — 413."""


# --- Storage -------------------------------------------------------------------------------


def get_guide_dir() -> Path:
    override = get_settings().guide_storage_dir
    return Path(override) if override else UPLOADS_DIR / GUIDES_SUBDIR


def max_upload_bytes() -> int:
    return get_settings().guide_max_upload_mb * 1024 * 1024


def _safe_path(stored_filename: str) -> Path:
    """stored_filename is always one we generated, but resolve and confirm it anyway."""
    guide_dir = get_guide_dir().resolve()
    candidate = (guide_dir / stored_filename).resolve()
    if not candidate.is_relative_to(guide_dir) or candidate == guide_dir:
        raise GuideValidationError("Invalid guide path")
    return candidate


def file_path(stored_filename: str) -> Path:
    return _safe_path(stored_filename)


def delete_files(stored_filenames: list[str]) -> None:
    for stored_filename in stored_filenames:
        try:
            _safe_path(stored_filename).unlink(missing_ok=True)
        except (OSError, GuideValidationError):
            pass


def filenames_of(guide: GameGuide) -> list[str]:
    return [name for name in (guide.stored_filename, guide.rendered_filename) if name]


_PENDING_DELETES_KEY = "guide_files_to_delete"


def delete_files_after_commit(db: Session, stored_filenames: list[str]) -> None:
    """For bulk deletes of guide rows (game_repository._delete_games, Danger Zone): the files
    are removed once the session's transaction commits, and kept if it rolls back — so every
    path that deletes games cleans up without each caller having to."""
    if stored_filenames:
        db.info.setdefault(_PENDING_DELETES_KEY, []).extend(stored_filenames)


@event.listens_for(Session, "after_commit")
def _delete_pending_files(session: Session) -> None:
    pending = session.info.pop(_PENDING_DELETES_KEY, None)
    if pending:
        delete_files(pending)


@event.listens_for(Session, "after_rollback")
def _forget_pending_files(session: Session) -> None:
    session.info.pop(_PENDING_DELETES_KEY, None)


def clear_folder(keep: set[str] | None = None) -> None:
    """Removes every file in the guide folder except `keep` — after a Danger Zone clear or
    reset (keep nothing), or a restore without files (keep the ones whose rows survived)."""
    guide_dir = get_guide_dir()
    if not guide_dir.is_dir():
        return
    keep = keep or set()
    for entry in guide_dir.iterdir():
        if entry.is_file() and entry.name not in keep:
            entry.unlink(missing_ok=True)


def _extension_of(filename: str) -> str:
    return PurePosixPath(filename.replace("\\", "/")).suffix.removeprefix(".").lower()


def accepted_extensions() -> list[str]:
    return list(_EXTENSION_FORMATS)


def format_for_filename(filename: str) -> GuideFormat:
    extension = _extension_of(filename)
    if extension in _HTML_EXTENSIONS:
        raise GuideValidationError(HTML_REJECTED_MESSAGE)
    if extension == "doc":
        raise GuideValidationError(DOC_REJECTED_MESSAGE)
    media_format = _EXTENSION_FORMATS.get(extension)
    if media_format is None:
        raise GuideValidationError(UNSUPPORTED_MESSAGE)
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
        raise GuideValidationError("This doesn't look like a text file")
    try:
        return raw.decode("utf-8-sig"), True
    except UnicodeDecodeError:
        pass
    try:
        return raw.decode("cp1252"), False
    except UnicodeDecodeError as exc:
        raise GuideValidationError("This doesn't look like a text file") from exc


def _refuse_html_lookalike(text: str) -> None:
    head = text[:1024].lstrip().lower()
    if head.startswith(_HTML_LOOKALIKE_PREFIXES):
        raise GuideValidationError(HTML_REJECTED_MESSAGE)


def _check_pdf(path: Path) -> None:
    with path.open("rb") as handle:
        head = handle.read(1024)
    if b"%PDF-" not in head:
        raise GuideValidationError("This isn't a valid PDF file")


def _convert_docx(path: Path) -> str:
    try:
        with zipfile.ZipFile(path) as archive:
            names = set(archive.namelist())
            if "word/document.xml" not in names or "[Content_Types].xml" not in names:
                raise GuideValidationError("This isn't a valid Word (.docx) file")
            if sum(info.file_size for info in archive.infolist()) > DOCX_MAX_EXPANSION * max_upload_bytes():
                raise GuideValidationError("This Word file is too large once unpacked")
    except zipfile.BadZipFile as exc:
        raise GuideValidationError("This isn't a valid Word (.docx) file") from exc
    try:
        with path.open("rb") as handle:
            result = mammoth.convert_to_html(handle)
    except Exception as exc:  # mammoth raises a variety of parse errors for damaged files
        raise GuideValidationError("Couldn't read this Word file") from exc
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


def _build_rendered(stored_filename: str, media_format: GuideFormat) -> str | None:
    """Checks the stored original's content and writes its rendered copy, if it needs one.
    Returns the rendered copy's file name (or None). Raises GuideValidationError, leaving any
    rendered copy it started removed; the caller removes the original."""
    path = _safe_path(stored_filename)
    stem = stored_filename.rsplit(".", 1)[0]
    if media_format is GuideFormat.PDF:
        _check_pdf(path)
        return None
    if media_format is GuideFormat.DOCX:
        html = _convert_docx(path)
        rendered = stem + RENDER_HTML_SUFFIX
        _safe_path(rendered).write_text(html, encoding="utf-8")
        return rendered
    text, was_utf8 = _decode_text(path.read_bytes())
    _refuse_html_lookalike(text)
    if media_format is GuideFormat.MD:
        rendered = stem + RENDER_HTML_SUFFIX
        _safe_path(rendered).write_text(render_markdown(text), encoding="utf-8")
        return rendered
    if was_utf8:
        return None
    rendered = stem + RENDER_TEXT_SUFFIX
    _safe_path(rendered).write_text(text, encoding="utf-8")
    return rendered


@dataclass
class _StoredUpload:
    original_filename: str
    stored_filename: str
    rendered_filename: str | None
    media_format: GuideFormat
    size_bytes: int

    def filenames(self) -> list[str]:
        return [name for name in (self.stored_filename, self.rendered_filename) if name]


def _store_upload(source: BinaryIO, original_filename: str) -> _StoredUpload:
    original_filename = PurePosixPath(original_filename.replace("\\", "/")).name.strip()
    if not original_filename:
        raise GuideValidationError("The file has no name")
    media_format = format_for_filename(original_filename)
    stored_filename = f"{uuid.uuid4().hex}.{_extension_of(original_filename)}"
    limit_mb = get_settings().guide_max_upload_mb
    size = file_storage.stream_to_path(
        source,
        _safe_path(stored_filename),
        max_upload_bytes(),
        too_large=lambda: GuideTooLargeError(f"The file is larger than {limit_mb} MB"),
        empty=lambda: GuideValidationError("The file is empty"),
    )
    try:
        rendered_filename = _build_rendered(stored_filename, media_format)
    except BaseException:
        stem = stored_filename.rsplit(".", 1)[0]
        delete_files([stored_filename, stem + RENDER_HTML_SUFFIX, stem + RENDER_TEXT_SUFFIX])
        raise
    return _StoredUpload(original_filename[:255], stored_filename, rendered_filename, media_format, size)


def rebuild_rendered(guide: GameGuide) -> None:
    """After a restore extracts a guide's original: rebuild its rendered copy from it, so the
    HTML a reader sees is always one this server sanitised. An original that no longer passes
    the checks (a hand-edited backup) keeps its row but gets no rendered copy."""
    guide.rendered_filename = None
    if guide.source is not GuideSource.FILE or not guide.stored_filename or guide.media_format is None:
        return
    if not _safe_path(guide.stored_filename).is_file():
        return
    try:
        guide.rendered_filename = _build_rendered(guide.stored_filename, guide.media_format)
    except GuideValidationError:
        guide.rendered_filename = None


# --- Links ---------------------------------------------------------------------------------


def validate_url(url: str) -> str:
    url = url.strip()
    if not url:
        raise GuideValidationError("Enter a link")
    if len(url) > MAX_URL_LENGTH:
        raise GuideValidationError(f"The link is longer than {MAX_URL_LENGTH} characters")
    if any(ch.isspace() or ord(ch) < 32 for ch in url):
        raise GuideValidationError("The link can't contain spaces")
    try:
        parts = urlsplit(url)
        hostname = parts.hostname
    except ValueError as exc:
        raise GuideValidationError("That isn't a valid link") from exc
    if parts.scheme.lower() not in ("http", "https") or not hostname:
        raise GuideValidationError("Only http and https links are supported")
    if parts.username is not None or parts.password is not None:
        raise GuideValidationError("Links can't contain a username or password")
    return url


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


# --- Entries -------------------------------------------------------------------------------


def _require_game(db: Session, game_id: int) -> None:
    if db.get(Game, game_id) is None:
        raise NotFoundError(f"Game {game_id} not found")


def _check_platform(db: Session, platform_id: int | None) -> None:
    if platform_id is not None and db.get(Platform, platform_id) is None:
        raise GuideValidationError("That platform doesn't exist")


def _clean_name(name: str | None, fallback: str) -> str:
    cleaned = (name or "").strip() or fallback.strip() or "Untitled"
    return cleaned[:MAX_NAME_LENGTH]


def _name_from_filename(filename: str) -> str:
    base = PurePosixPath(filename.replace("\\", "/")).name
    return base.rsplit(".", 1)[0] if "." in base else base


def _commit_or_discard(db: Session, new_files: list[str]) -> None:
    try:
        db.commit()
    except BaseException:
        db.rollback()
        delete_files(new_files)
        raise


def get_guide(db: Session, guide_id: int) -> GameGuide:
    guide = db.get(GameGuide, guide_id)
    if guide is None:
        raise NotFoundError(f"Guide {guide_id} not found")
    return guide


def list_for_game(db: Session, game_id: int) -> list[GameGuide]:
    """Guides first, then cheats, each by name ignoring case."""
    _require_game(db, game_id)
    guides = db.execute(select(GameGuide).where(GameGuide.game_id == game_id)).scalars().all()
    kind_order = {GuideKind.GUIDE: 0, GuideKind.CHEAT: 1}
    return sorted(guides, key=lambda g: (kind_order[g.kind], g.name.casefold(), g.id))


def file_missing(guide: GameGuide) -> bool:
    if guide.source is not GuideSource.FILE or not guide.stored_filename:
        return False
    try:
        return not _safe_path(guide.stored_filename).is_file()
    except GuideValidationError:
        return True


def create_file(
    db: Session,
    game_id: int,
    source: BinaryIO,
    original_filename: str,
    kind: GuideKind,
    name: str | None = None,
    platform_id: int | None = None,
) -> GameGuide:
    _require_game(db, game_id)
    _check_platform(db, platform_id)
    stored = _store_upload(source, original_filename)
    guide = GameGuide(
        game_id=game_id,
        name=_clean_name(name, _name_from_filename(stored.original_filename)),
        kind=kind,
        platform_id=platform_id,
        source=GuideSource.FILE,
        url=None,
        original_filename=stored.original_filename,
        stored_filename=stored.stored_filename,
        rendered_filename=stored.rendered_filename,
        media_format=stored.media_format,
        size_bytes=stored.size_bytes,
    )
    db.add(guide)
    _commit_or_discard(db, stored.filenames())
    db.refresh(guide)
    return guide


def create_link(
    db: Session,
    game_id: int,
    url: str,
    kind: GuideKind,
    name: str | None = None,
    platform_id: int | None = None,
) -> GameGuide:
    _require_game(db, game_id)
    _check_platform(db, platform_id)
    url = validate_url(url)
    guide = GameGuide(
        game_id=game_id,
        name=_clean_name(name, domain_of(url) or url),
        kind=kind,
        platform_id=platform_id,
        source=GuideSource.LINK,
        url=url,
    )
    db.add(guide)
    db.commit()
    db.refresh(guide)
    return guide


def _clear_file_columns(guide: GameGuide) -> None:
    guide.original_filename = None
    guide.stored_filename = None
    guide.rendered_filename = None
    guide.media_format = None
    guide.size_bytes = None


def update(db: Session, guide_id: int, changes: dict) -> GameGuide:
    """PATCH semantics: only the keys present change. `platform_id: None` clears it. Setting
    `url` on a file entry turns it into a link, and its files go once that commits."""
    guide = get_guide(db, guide_id)
    old_files: list[str] = []
    if "platform_id" in changes:
        _check_platform(db, changes["platform_id"])
        guide.platform_id = changes["platform_id"]
    if changes.get("kind") is not None:
        guide.kind = changes["kind"]
    if "url" in changes:
        if changes["url"] is None:
            raise GuideValidationError("Enter a link")
        guide.url = validate_url(changes["url"])
        if guide.source is GuideSource.FILE:
            old_files = filenames_of(guide)
            _clear_file_columns(guide)
            guide.source = GuideSource.LINK
    if "name" in changes:
        fallback = (
            _name_from_filename(guide.original_filename or "")
            if guide.source is GuideSource.FILE
            else (domain_of(guide.url) or "")
        )
        guide.name = _clean_name(changes["name"], fallback)
    db.commit()
    db.refresh(guide)
    delete_files(old_files)
    return guide


def replace_file(db: Session, guide_id: int, source: BinaryIO, original_filename: str) -> GameGuide:
    """Swaps in a new file — on a file entry, or turning a link into a file. The new file is
    written and checked first, so a refused upload leaves the entry as it was."""
    guide = get_guide(db, guide_id)
    stored = _store_upload(source, original_filename)
    old_files = filenames_of(guide)
    guide.source = GuideSource.FILE
    guide.url = None
    guide.original_filename = stored.original_filename
    guide.stored_filename = stored.stored_filename
    guide.rendered_filename = stored.rendered_filename
    guide.media_format = stored.media_format
    guide.size_bytes = stored.size_bytes
    _commit_or_discard(db, stored.filenames())
    db.refresh(guide)
    delete_files(old_files)
    return guide


def delete(db: Session, guide_id: int) -> None:
    guide = get_guide(db, guide_id)
    files = filenames_of(guide)
    db.delete(guide)
    db.commit()
    delete_files(files)


# --- Serving -------------------------------------------------------------------------------

_DOWNLOAD_MEDIA_TYPES = {
    GuideFormat.PDF: "application/pdf",
    GuideFormat.DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    GuideFormat.MD: "text/markdown; charset=utf-8",
    GuideFormat.TXT: "text/plain; charset=utf-8",
}


@dataclass
class ServedFile:
    path: Path
    media_type: str
    # "html" (a rendered page), "pdf" or "text": decides the content route's policy.
    kind: str
    download_name: str | None = None


def _require_file(guide: GameGuide) -> None:
    if guide.source is not GuideSource.FILE:
        raise ConflictError("This entry is a link, not a file")
    if file_missing(guide):
        raise NotFoundError("This guide's file is missing")


def view_file(guide: GameGuide) -> ServedFile:
    """What the reader shows: the rendered HTML (Word/Markdown), the UTF-8 copy of a non-UTF-8
    text file, or the original (PDF, UTF-8 text)."""
    _require_file(guide)
    if guide.media_format in (GuideFormat.DOCX, GuideFormat.MD):
        if not guide.rendered_filename or not _safe_path(guide.rendered_filename).is_file():
            raise NotFoundError("This guide's file is missing")
        return ServedFile(_safe_path(guide.rendered_filename), "text/html; charset=utf-8", "html")
    if guide.media_format is GuideFormat.PDF:
        return ServedFile(_safe_path(guide.stored_filename), "application/pdf", "pdf")
    name = guide.rendered_filename or guide.stored_filename
    return ServedFile(_safe_path(name), "text/plain; charset=utf-8", "text")


def download_file(guide: GameGuide) -> ServedFile:
    _require_file(guide)
    media_type = _DOWNLOAD_MEDIA_TYPES.get(guide.media_format, "application/octet-stream")
    if guide.media_format is GuideFormat.TXT and guide.rendered_filename:
        # The original isn't UTF-8 (it was read as Windows-1252): hand it back byte for byte.
        media_type = "text/plain; charset=windows-1252"
    return ServedFile(
        _safe_path(guide.stored_filename),
        media_type,
        "download",
        download_name=guide.original_filename or guide.stored_filename,
    )
