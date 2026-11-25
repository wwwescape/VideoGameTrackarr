"""Manuals & Documents on Toys-to-Life packs (see app/services/toys_to_life_document_service.py)."""

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.document_content import content_url, serve, upload_error_to_http
from app.api.routes.hardware_documents import check_document_token, parse_kind
from app.core.security import create_document_token
from app.models.documents import HardwareDocumentKind
from app.models.system import User
from app.models.toys_to_life import ToysToLifeDocument
from app.schemas.guide import GuideLinkResponse
from app.schemas.hardware_document import (
    DocumentLinkCreateRequest,
    DocumentUpdateRequest,
    ToysToLifeDocumentResponse,
    toys_to_life_document_from_orm,
)
from app.services import document_files
from app.services import toys_to_life_document_service as service
from app.services.document_files import HARDWARE_STORE, DocumentTooLargeError, DocumentValidationError

router = APIRouter(tags=["toys-to-life-documents"], dependencies=[Depends(get_current_user)])
content_router = APIRouter(tags=["toys-to-life-documents"])

_PREFIX = "/api/toys-to-life-documents"
_SCOPE = "toys_to_life"


def _response(db: Session, document: ToysToLifeDocument) -> ToysToLifeDocumentResponse:
    return toys_to_life_document_from_orm(document, service.copy_numbers(db, document.item_id))


@router.get("/api/toys-to-life/items/{item_id}/documents", response_model=list[ToysToLifeDocumentResponse])
def list_documents(item_id: int, db: Session = Depends(get_db)) -> list[ToysToLifeDocumentResponse]:
    documents = service.list_for_item(db, item_id)
    numbers = service.copy_numbers(db, item_id)
    return [toys_to_life_document_from_orm(document, numbers) for document in documents]


@router.post(
    "/api/toys-to-life/items/{item_id}/documents/file",
    response_model=ToysToLifeDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_document_file(
    item_id: int,
    file: UploadFile = File(...),
    kind: str = Form(default=HardwareDocumentKind.MANUAL.value),
    name: str | None = Form(default=None, max_length=document_files.MAX_NAME_LENGTH),
    copy_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
) -> ToysToLifeDocumentResponse:
    document_kind = parse_kind(kind)
    try:
        document = service.create_file(
            db, item_id, file.file, file.filename or "", document_kind, name=name, copy_id=copy_id
        )
    except (DocumentTooLargeError, DocumentValidationError) as exc:
        raise upload_error_to_http(exc) from exc
    return _response(db, document)


@router.post(
    "/api/toys-to-life/items/{item_id}/documents/link",
    response_model=ToysToLifeDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_document_link(
    item_id: int, body: DocumentLinkCreateRequest, db: Session = Depends(get_db)
) -> ToysToLifeDocumentResponse:
    try:
        document = service.create_link(db, item_id, body.url, body.kind, name=body.name, copy_id=body.copy_id)
    except DocumentValidationError as exc:
        raise upload_error_to_http(exc) from exc
    return _response(db, document)


@router.patch("/api/toys-to-life-documents/{document_id}", response_model=ToysToLifeDocumentResponse)
def update_document(
    document_id: int, body: DocumentUpdateRequest, db: Session = Depends(get_db)
) -> ToysToLifeDocumentResponse:
    changes = {field: getattr(body, field) for field in body.model_fields_set}
    try:
        document = service.update_document(db, document_id, changes)
    except DocumentValidationError as exc:
        raise upload_error_to_http(exc) from exc
    return _response(db, document)


@router.put("/api/toys-to-life-documents/{document_id}/file", response_model=ToysToLifeDocumentResponse)
def replace_document_file(
    document_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
) -> ToysToLifeDocumentResponse:
    try:
        document = service.replace_file(db, document_id, file.file, file.filename or "")
    except (DocumentTooLargeError, DocumentValidationError) as exc:
        raise upload_error_to_http(exc) from exc
    return _response(db, document)


@router.delete("/api/toys-to-life-documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: int, db: Session = Depends(get_db)) -> None:
    service.delete_document(db, document_id)


@router.post("/api/toys-to-life-documents/{document_id}/view-link", response_model=GuideLinkResponse)
def create_view_link(
    document_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GuideLinkResponse:
    document = service.get_document(db, document_id)
    served = HARDWARE_STORE.view_file(document)
    token = create_document_token(current_user.id, _SCOPE, document.id, "view")
    return GuideLinkResponse(url=content_url(_PREFIX, document.id, token, served.path.name))


@router.post("/api/toys-to-life-documents/{document_id}/download-link", response_model=GuideLinkResponse)
def create_download_link(
    document_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> GuideLinkResponse:
    document = service.get_document(db, document_id)
    served = HARDWARE_STORE.download_file(document)
    token = create_document_token(current_user.id, _SCOPE, document.id, "download")
    return GuideLinkResponse(url=content_url(_PREFIX, document.id, token, served.download_name or served.path.name))


@content_router.api_route(
    "/api/toys-to-life-documents/{document_id}/content/{token}/{filename}", methods=["GET", "HEAD"]
)
def get_document_content(document_id: int, token: str, filename: str, db: Session = Depends(get_db)) -> Response:
    mode = check_document_token(db, token, _SCOPE, document_id)
    return serve(HARDWARE_STORE, service.get_document(db, document_id), mode)
