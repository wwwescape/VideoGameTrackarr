"""Guides & Cheats (see app/services/guide_service.py)."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.document_content import content_url, serve, upload_error_to_http
from app.core.config import get_settings
from app.core.security import TokenError, TokenType, create_guide_token, decode_token
from app.models.library import GameDocument, GuideKind
from app.models.system import User
from app.schemas.guide import (
    GuideLinkCreateRequest,
    GuideLinkResponse,
    GuideResponse,
    GuideUpdateRequest,
    GuideUploadOptionsResponse,
    guide_from_orm,
)
from app.services import document_files, guide_service
from app.services.document_files import GUIDE_STORE, DocumentTooLargeError, DocumentValidationError

router = APIRouter(tags=["guides"], dependencies=[Depends(get_current_user)])
# The content route is reached from the reader's PDF viewer, a new tab or a download — none
# of which can send an Authorization header — so it's authorised by its signed path instead.
content_router = APIRouter(tags=["guides"])

_PREFIX = "/api/guides"


def _parse_kind(kind: str) -> GuideKind:
    try:
        return GuideKind(kind)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type must be one of {', '.join(k.value for k in GuideKind)}",
        ) from exc


def _response(db: Session, guide: GameDocument) -> GuideResponse:
    return guide_from_orm(guide, guide_service.copy_numbers(db, guide.game_id))


@router.get("/api/guides/upload-options", response_model=GuideUploadOptionsResponse)
def get_upload_options() -> GuideUploadOptionsResponse:
    return GuideUploadOptionsResponse(
        max_upload_mb=get_settings().guide_max_upload_mb, extensions=document_files.accepted_extensions()
    )


@router.get("/api/games/{game_id}/guides", response_model=list[GuideResponse])
def list_guides(game_id: int, db: Session = Depends(get_db)) -> list[GuideResponse]:
    guides = guide_service.list_for_game(db, game_id)
    numbers = guide_service.copy_numbers(db, game_id)
    return [guide_from_orm(guide, numbers) for guide in guides]


@router.post("/api/games/{game_id}/guides/file", response_model=GuideResponse, status_code=status.HTTP_201_CREATED)
def create_guide_file(
    game_id: int,
    file: UploadFile = File(...),
    kind: str = Form(default=GuideKind.GUIDE.value),
    name: str | None = Form(default=None, max_length=document_files.MAX_NAME_LENGTH),
    platform_id: int | None = Form(default=None),
    copy_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
) -> GuideResponse:
    guide_kind = _parse_kind(kind)
    try:
        guide = guide_service.create_file(
            db,
            game_id,
            file.file,
            file.filename or "",
            guide_kind,
            name=name,
            platform_id=platform_id,
            library_item_id=copy_id,
        )
    except (DocumentTooLargeError, DocumentValidationError) as exc:
        raise upload_error_to_http(exc) from exc
    return _response(db, guide)


@router.post("/api/games/{game_id}/guides/link", response_model=GuideResponse, status_code=status.HTTP_201_CREATED)
def create_guide_link(game_id: int, body: GuideLinkCreateRequest, db: Session = Depends(get_db)) -> GuideResponse:
    try:
        guide = guide_service.create_link(
            db,
            game_id,
            body.url,
            body.kind,
            name=body.name,
            platform_id=body.platform_id,
            library_item_id=body.copy_id,
        )
    except DocumentValidationError as exc:
        raise upload_error_to_http(exc) from exc
    return _response(db, guide)


@router.patch("/api/guides/{guide_id}", response_model=GuideResponse)
def update_guide(guide_id: int, body: GuideUpdateRequest, db: Session = Depends(get_db)) -> GuideResponse:
    changes = {field: getattr(body, field) for field in body.model_fields_set}
    if "copy_id" in changes:
        changes["library_item_id"] = changes.pop("copy_id")
    try:
        guide = guide_service.update(db, guide_id, changes)
    except DocumentValidationError as exc:
        raise upload_error_to_http(exc) from exc
    return _response(db, guide)


@router.put("/api/guides/{guide_id}/file", response_model=GuideResponse)
def replace_guide_file(guide_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)) -> GuideResponse:
    try:
        guide = guide_service.replace_file(db, guide_id, file.file, file.filename or "")
    except (DocumentTooLargeError, DocumentValidationError) as exc:
        raise upload_error_to_http(exc) from exc
    return _response(db, guide)


@router.delete("/api/guides/{guide_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_guide(guide_id: int, db: Session = Depends(get_db)) -> None:
    guide_service.delete(db, guide_id)


@router.post("/api/guides/{guide_id}/view-link", response_model=GuideLinkResponse)
def create_view_link(
    guide_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GuideLinkResponse:
    """A signed link the reader (or a new tab) opens: the rendered page for Word/Markdown,
    the text for .txt, the PDF or image itself. Asked for afresh each time the reader opens."""
    guide = guide_service.get_guide(db, guide_id)
    served = GUIDE_STORE.view_file(guide)
    token = create_guide_token(current_user.id, guide.id, "view")
    return GuideLinkResponse(url=content_url(_PREFIX, guide.id, token, served.path.name))


@router.post("/api/guides/{guide_id}/download-link", response_model=GuideLinkResponse)
def create_download_link(
    guide_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GuideLinkResponse:
    guide = guide_service.get_guide(db, guide_id)
    served = GUIDE_STORE.download_file(guide)
    token = create_guide_token(current_user.id, guide.id, "download")
    return GuideLinkResponse(url=content_url(_PREFIX, guide.id, token, served.download_name or served.path.name))


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
    return serve(GUIDE_STORE, guide_service.get_guide(db, guide_id), mode)
