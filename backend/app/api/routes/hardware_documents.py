"""Manuals & Documents on devices and accessories (see app/services/hardware_document_service.py)."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.document_content import content_url, serve, upload_error_to_http
from app.core.config import get_settings
from app.core.security import TokenError, TokenType, create_document_token, decode_token
from app.models.documents import HardwareDocumentKind
from app.models.hardware import HardwareDocument
from app.models.system import User
from app.schemas.guide import GuideLinkResponse, GuideUploadOptionsResponse
from app.schemas.hardware_document import (
    DocumentLinkCreateRequest,
    DocumentUpdateRequest,
    HardwareDocumentResponse,
    hardware_document_from_orm,
)
from app.services import document_files
from app.services import hardware_document_service as service
from app.services.document_files import HARDWARE_STORE, DocumentTooLargeError, DocumentValidationError
from app.services.hardware_document_service import OwnerType

router = APIRouter(tags=["hardware-documents"], dependencies=[Depends(get_current_user)])
# Reached from the reader, a new tab or a download, none of which can send an Authorization
# header, so it's authorised by its signed path instead.
content_router = APIRouter(tags=["hardware-documents"])

_PREFIX = "/api/hardware-documents"
_SCOPE = "hardware"


def parse_kind(kind: str) -> HardwareDocumentKind:
    try:
        return HardwareDocumentKind(kind)
    except ValueError as exc:
        allowed = ", ".join(k.value for k in HardwareDocumentKind)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Type must be one of {allowed}") from exc


def _response(db: Session, document: HardwareDocument) -> HardwareDocumentResponse:
    owner_type, owner_id = service.owner_of(document)
    return hardware_document_from_orm(document, service.copies_of(db, owner_type, owner_id))


def _list(db: Session, owner_type: OwnerType, owner_id: int) -> list[HardwareDocumentResponse]:
    documents = service.list_for_owner(db, owner_type, owner_id)
    copies = service.copies_of(db, owner_type, owner_id)
    return [hardware_document_from_orm(document, copies) for document in documents]


def _create_file(
    db: Session,
    owner_type: OwnerType,
    owner_id: int,
    file: UploadFile,
    kind: str,
    name: str | None,
    copy_id: int | None,
) -> HardwareDocumentResponse:
    document_kind = parse_kind(kind)
    try:
        document = service.create_file(
            db, owner_type, owner_id, file.file, file.filename or "", document_kind, name=name, copy_id=copy_id
        )
    except (DocumentTooLargeError, DocumentValidationError) as exc:
        raise upload_error_to_http(exc) from exc
    return _response(db, document)


def _create_link(
    db: Session, owner_type: OwnerType, owner_id: int, body: DocumentLinkCreateRequest
) -> HardwareDocumentResponse:
    try:
        document = service.create_link(
            db, owner_type, owner_id, body.url, body.kind, name=body.name, copy_id=body.copy_id
        )
    except DocumentValidationError as exc:
        raise upload_error_to_http(exc) from exc
    return _response(db, document)


@router.get("/api/hardware-documents/upload-options", response_model=GuideUploadOptionsResponse)
def get_upload_options() -> GuideUploadOptionsResponse:
    return GuideUploadOptionsResponse(
        max_upload_mb=get_settings().guide_max_upload_mb, extensions=document_files.accepted_extensions()
    )


@router.get("/api/devices/{device_id}/documents", response_model=list[HardwareDocumentResponse])
def list_device_documents(device_id: int, db: Session = Depends(get_db)) -> list[HardwareDocumentResponse]:
    return _list(db, "device", device_id)


@router.get("/api/accessories/{accessory_id}/documents", response_model=list[HardwareDocumentResponse])
def list_accessory_documents(accessory_id: int, db: Session = Depends(get_db)) -> list[HardwareDocumentResponse]:
    return _list(db, "accessory", accessory_id)


@router.post(
    "/api/devices/{device_id}/documents/file",
    response_model=HardwareDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_device_document_file(
    device_id: int,
    file: UploadFile = File(...),
    kind: str = Form(default=HardwareDocumentKind.MANUAL.value),
    name: str | None = Form(default=None, max_length=document_files.MAX_NAME_LENGTH),
    copy_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
) -> HardwareDocumentResponse:
    return _create_file(db, "device", device_id, file, kind, name, copy_id)


@router.post(
    "/api/accessories/{accessory_id}/documents/file",
    response_model=HardwareDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_accessory_document_file(
    accessory_id: int,
    file: UploadFile = File(...),
    kind: str = Form(default=HardwareDocumentKind.MANUAL.value),
    name: str | None = Form(default=None, max_length=document_files.MAX_NAME_LENGTH),
    copy_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
) -> HardwareDocumentResponse:
    return _create_file(db, "accessory", accessory_id, file, kind, name, copy_id)


@router.post(
    "/api/devices/{device_id}/documents/link",
    response_model=HardwareDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_device_document_link(
    device_id: int, body: DocumentLinkCreateRequest, db: Session = Depends(get_db)
) -> HardwareDocumentResponse:
    return _create_link(db, "device", device_id, body)


@router.post(
    "/api/accessories/{accessory_id}/documents/link",
    response_model=HardwareDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_accessory_document_link(
    accessory_id: int, body: DocumentLinkCreateRequest, db: Session = Depends(get_db)
) -> HardwareDocumentResponse:
    return _create_link(db, "accessory", accessory_id, body)


@router.patch("/api/hardware-documents/{document_id}", response_model=HardwareDocumentResponse)
def update_document(
    document_id: int, body: DocumentUpdateRequest, db: Session = Depends(get_db)
) -> HardwareDocumentResponse:
    changes = {field: getattr(body, field) for field in body.model_fields_set}
    try:
        document = service.update_document(db, document_id, changes)
    except DocumentValidationError as exc:
        raise upload_error_to_http(exc) from exc
    return _response(db, document)


@router.put("/api/hardware-documents/{document_id}/file", response_model=HardwareDocumentResponse)
def replace_document_file(
    document_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
) -> HardwareDocumentResponse:
    try:
        document = service.replace_file(db, document_id, file.file, file.filename or "")
    except (DocumentTooLargeError, DocumentValidationError) as exc:
        raise upload_error_to_http(exc) from exc
    return _response(db, document)


@router.delete("/api/hardware-documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: int, db: Session = Depends(get_db)) -> None:
    service.delete_document(db, document_id)


@router.post("/api/hardware-documents/{document_id}/view-link", response_model=GuideLinkResponse)
def create_view_link(
    document_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GuideLinkResponse:
    document = service.get_document(db, document_id)
    served = HARDWARE_STORE.view_file(document)
    token = create_document_token(current_user.id, _SCOPE, document.id, "view")
    return GuideLinkResponse(url=content_url(_PREFIX, document.id, token, served.path.name))


@router.post("/api/hardware-documents/{document_id}/download-link", response_model=GuideLinkResponse)
def create_download_link(
    document_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GuideLinkResponse:
    document = service.get_document(db, document_id)
    served = HARDWARE_STORE.download_file(document)
    token = create_document_token(current_user.id, _SCOPE, document.id, "download")
    return GuideLinkResponse(url=content_url(_PREFIX, document.id, token, served.download_name or served.path.name))


def check_document_token(db: Session, token: str, scope: str, document_id: int) -> str:
    """Checks a signed content link and returns its mode ("view" or "download")."""
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired document link")
    try:
        payload = decode_token(token, TokenType.DOCUMENT)
    except TokenError as exc:
        raise unauthorized from exc
    if payload.get("scope") != scope or payload.get("document") != document_id:
        raise unauthorized
    if db.get(User, int(payload["sub"])) is None:
        raise unauthorized
    mode = payload.get("mode")
    if mode not in ("view", "download"):
        raise unauthorized
    return mode


@content_router.api_route("/api/hardware-documents/{document_id}/content/{token}/{filename}", methods=["GET", "HEAD"])
def get_document_content(document_id: int, token: str, filename: str, db: Session = Depends(get_db)) -> Response:
    """The trailing {filename} is only for the browser (a tab title, the saved file's name);
    the token decides which document and whether it's viewed or downloaded."""
    mode = check_document_token(db, token, _SCOPE, document_id)
    return serve(HARDWARE_STORE, service.get_document(db, document_id), mode)
