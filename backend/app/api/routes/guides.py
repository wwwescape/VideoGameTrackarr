"""Guides & Cheats (see app/services/guide_service.py)."""

from html import escape
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.core.security import TokenError, TokenType, create_guide_token, decode_token
from app.models.library import GuideKind
from app.models.system import User
from app.schemas.guide import (
    GuideLinkCreateRequest,
    GuideLinkResponse,
    GuideResponse,
    GuideUpdateRequest,
    GuideUploadOptionsResponse,
    guide_from_orm,
)
from app.services import guide_service

router = APIRouter(tags=["guides"], dependencies=[Depends(get_current_user)])
# The content route is reached from the reader's PDF viewer, a new tab or a download — none
# of which can send an Authorization header — so it's authorised by its signed path instead.
content_router = APIRouter(tags=["guides"])

# Every guide file response gets this policy (main.py's security_headers_for applies it to
# the content path, errors included): nothing loads, nothing runs, and as a sandboxed
# document it has no access to the app's origin even when opened in its own tab.
GUIDE_CONTENT_SECURITY_POLICY = "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'"
# Browsers refuse to run their built-in PDF viewer in a sandboxed document, so a PDF gets
# everything above except `sandbox`. A PDF can't reach the app's origin from the viewer anyway.
GUIDE_PDF_CONTENT_SECURITY_POLICY = "default-src 'none'; object-src 'none'; img-src data:; style-src 'unsafe-inline'"

_PAGE_STYLE = (
    "body{max-width:48rem;margin:2rem auto;padding:0 1rem;font:16px/1.6 system-ui,sans-serif;"
    "color:#1f2328;background:#fff}img{max-width:100%;height:auto}table{border-collapse:collapse;"
    "display:block;overflow-x:auto}td,th{border:1px solid #d0d7de;padding:.25rem .5rem}"
    "pre{overflow-x:auto}@media (prefers-color-scheme:dark){body{color:#e6edf3;background:#0d1117}"
    "td,th{border-color:#30363d}}"
)


def _upload_errors_to_http(exc: Exception) -> HTTPException:
    if isinstance(exc, guide_service.GuideTooLargeError):
        return HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _parse_kind(kind: str) -> GuideKind:
    try:
        return GuideKind(kind)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Type must be guide or cheat") from exc


@router.get("/api/guides/upload-options", response_model=GuideUploadOptionsResponse)
def get_upload_options() -> GuideUploadOptionsResponse:
    return GuideUploadOptionsResponse(
        max_upload_mb=get_settings().guide_max_upload_mb, extensions=guide_service.accepted_extensions()
    )


@router.get("/api/games/{game_id}/guides", response_model=list[GuideResponse])
def list_guides(game_id: int, db: Session = Depends(get_db)) -> list[GuideResponse]:
    return [guide_from_orm(guide) for guide in guide_service.list_for_game(db, game_id)]


@router.post("/api/games/{game_id}/guides/file", response_model=GuideResponse, status_code=status.HTTP_201_CREATED)
def create_guide_file(
    game_id: int,
    file: UploadFile = File(...),
    kind: str = Form(default=GuideKind.GUIDE.value),
    name: str | None = Form(default=None, max_length=guide_service.MAX_NAME_LENGTH),
    platform_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
) -> GuideResponse:
    guide_kind = _parse_kind(kind)
    try:
        guide = guide_service.create_file(
            db, game_id, file.file, file.filename or "", guide_kind, name=name, platform_id=platform_id
        )
    except (guide_service.GuideTooLargeError, guide_service.GuideValidationError) as exc:
        raise _upload_errors_to_http(exc) from exc
    return guide_from_orm(guide)


@router.post("/api/games/{game_id}/guides/link", response_model=GuideResponse, status_code=status.HTTP_201_CREATED)
def create_guide_link(game_id: int, body: GuideLinkCreateRequest, db: Session = Depends(get_db)) -> GuideResponse:
    try:
        guide = guide_service.create_link(
            db, game_id, body.url, body.kind, name=body.name, platform_id=body.platform_id
        )
    except guide_service.GuideValidationError as exc:
        raise _upload_errors_to_http(exc) from exc
    return guide_from_orm(guide)


@router.patch("/api/guides/{guide_id}", response_model=GuideResponse)
def update_guide(guide_id: int, body: GuideUpdateRequest, db: Session = Depends(get_db)) -> GuideResponse:
    changes = {field: getattr(body, field) for field in body.model_fields_set}
    try:
        guide = guide_service.update(db, guide_id, changes)
    except guide_service.GuideValidationError as exc:
        raise _upload_errors_to_http(exc) from exc
    return guide_from_orm(guide)


@router.put("/api/guides/{guide_id}/file", response_model=GuideResponse)
def replace_guide_file(guide_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)) -> GuideResponse:
    try:
        guide = guide_service.replace_file(db, guide_id, file.file, file.filename or "")
    except (guide_service.GuideTooLargeError, guide_service.GuideValidationError) as exc:
        raise _upload_errors_to_http(exc) from exc
    return guide_from_orm(guide)


@router.delete("/api/guides/{guide_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_guide(guide_id: int, db: Session = Depends(get_db)) -> None:
    guide_service.delete(db, guide_id)


def _content_url(guide_id: int, token: str, filename: str) -> str:
    return f"/api/guides/{guide_id}/content/{token}/{quote(filename)}"


@router.post("/api/guides/{guide_id}/view-link", response_model=GuideLinkResponse)
def create_view_link(
    guide_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GuideLinkResponse:
    """A signed link the reader (or a new tab) opens: the rendered page for Word/Markdown,
    the text for .txt, the PDF itself. Asked for afresh each time the reader opens."""
    guide = guide_service.get_guide(db, guide_id)
    served = guide_service.view_file(guide)
    token = create_guide_token(current_user.id, guide.id, "view")
    return GuideLinkResponse(url=_content_url(guide.id, token, served.path.name))


@router.post("/api/guides/{guide_id}/download-link", response_model=GuideLinkResponse)
def create_download_link(
    guide_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GuideLinkResponse:
    guide = guide_service.get_guide(db, guide_id)
    served = guide_service.download_file(guide)
    token = create_guide_token(current_user.id, guide.id, "download")
    return GuideLinkResponse(url=_content_url(guide.id, token, served.download_name or served.path.name))


def _html_page(title: str, fragment: str) -> str:
    return (
        '<!doctype html><html><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f"<title>{escape(title)}</title><style>{_PAGE_STYLE}</style></head>"
        f"<body>{fragment}</body></html>"
    )


@content_router.api_route("/api/guides/{guide_id}/content/{token}/{filename}", methods=["GET", "HEAD"])
def get_guide_content(guide_id: int, token: str, filename: str, db: Session = Depends(get_db)) -> Response:
    """The trailing {filename} is only for the browser (a tab title, the saved file's name);
    the token decides which guide and whether it's viewed or downloaded."""
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired guide link")
    try:
        payload = decode_token(token, TokenType.GUIDE)
    except TokenError as exc:
        raise unauthorized from exc
    if payload.get("guide") != guide_id or db.get(User, int(payload["sub"])) is None:
        raise unauthorized
    mode = payload.get("mode")
    if mode not in ("view", "download"):
        raise unauthorized

    guide = guide_service.get_guide(db, guide_id)
    headers = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}

    if mode == "download":
        served = guide_service.download_file(guide)
        return FileResponse(served.path, media_type=served.media_type, filename=served.download_name, headers=headers)

    served = guide_service.view_file(guide)
    if served.kind == "html":
        fragment = served.path.read_text(encoding="utf-8")
        return Response(content=_html_page(guide.name, fragment), media_type=served.media_type, headers=headers)
    if served.kind == "pdf":
        headers["Content-Security-Policy"] = GUIDE_PDF_CONTENT_SECURITY_POLICY
    return FileResponse(
        served.path,
        media_type=served.media_type,
        filename=f"{guide.name}{'.pdf' if served.kind == 'pdf' else '.txt'}",
        content_disposition_type="inline",
        headers=headers,
    )
