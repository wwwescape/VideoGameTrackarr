"""Serving document files (Guides & Cheats, hardware and Toys-to-Life documents) through their
signed content routes, and the error mapping their upload routes share."""

from html import escape
from urllib.parse import quote

from fastapi import HTTPException, status
from fastapi.responses import FileResponse, Response

from app.services.document_files import DocumentEntry, DocumentStore, DocumentTooLargeError

# Every document file response gets this policy (main.py's security_headers_for applies it to
# the content paths, errors included): nothing loads, nothing runs, and as a sandboxed
# document it has no access to the app's origin even when opened in its own tab.
CONTENT_SECURITY_POLICY = "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'"
# Browsers refuse to run their built-in PDF viewer in a sandboxed document, so a PDF gets
# everything above except `sandbox`. A PDF can't reach the app's origin from the viewer anyway.
PDF_CONTENT_SECURITY_POLICY = "default-src 'none'; object-src 'none'; img-src data:; style-src 'unsafe-inline'"
# An image opened on its own: the browser's image page has to be allowed to show the image
# itself. Images can't run anything (SVG is never accepted).
IMAGE_CONTENT_SECURITY_POLICY = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"

_PAGE_STYLE = (
    "body{max-width:48rem;margin:2rem auto;padding:0 1rem;font:16px/1.6 system-ui,sans-serif;"
    "color:#1f2328;background:#fff}img{max-width:100%;height:auto}table{border-collapse:collapse;"
    "display:block;overflow-x:auto}td,th{border:1px solid #d0d7de;padding:.25rem .5rem}"
    "pre{overflow-x:auto}@media (prefers-color-scheme:dark){body{color:#e6edf3;background:#0d1117}"
    "td,th{border-color:#30363d}}"
)
_INLINE_EXTENSIONS = {"pdf": ".pdf", "text": ".txt"}


def upload_error_to_http(exc: Exception) -> HTTPException:
    if isinstance(exc, DocumentTooLargeError):
        return HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def content_url(prefix: str, entry_id: int, token: str, filename: str) -> str:
    """`prefix` is the route's base, e.g. /api/guides."""
    return f"{prefix}/{entry_id}/content/{token}/{quote(filename)}"


def _html_page(title: str, fragment: str) -> str:
    return (
        '<!doctype html><html><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f"<title>{escape(title)}</title><style>{_PAGE_STYLE}</style></head>"
        f"<body>{fragment}</body></html>"
    )


def serve(store: DocumentStore, entry: DocumentEntry, mode: str) -> Response:
    """The response for a checked signed link: the original as an attachment ("download"),
    or the reader's view of it ("view")."""
    headers = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}

    if mode == "download":
        served = store.download_file(entry)
        return FileResponse(served.path, media_type=served.media_type, filename=served.download_name, headers=headers)

    served = store.view_file(entry)
    if served.kind == "html":
        fragment = served.path.read_text(encoding="utf-8")
        return Response(content=_html_page(entry.name, fragment), media_type=served.media_type, headers=headers)
    if served.kind == "pdf":
        headers["Content-Security-Policy"] = PDF_CONTENT_SECURITY_POLICY
    if served.kind == "image":
        headers["Content-Security-Policy"] = IMAGE_CONTENT_SECURITY_POLICY
    extension = _INLINE_EXTENSIONS.get(served.kind) or served.path.suffix
    return FileResponse(
        served.path,
        media_type=served.media_type,
        filename=f"{entry.name}{extension}",
        content_disposition_type="inline",
        headers=headers,
    )
