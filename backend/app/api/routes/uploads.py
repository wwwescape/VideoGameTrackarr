from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.deps import get_current_user
from app.schemas.upload import UploadResponse
from app.services import upload_service

router = APIRouter(prefix="/api/uploads", tags=["uploads"], dependencies=[Depends(get_current_user)])


@router.post("/covers", response_model=UploadResponse, status_code=201)
async def upload_cover(file: UploadFile = File(...)) -> UploadResponse:
    raw = await file.read()
    try:
        url = upload_service.save_cover_image(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return UploadResponse(url=url)


@router.post("/accessory-images", response_model=UploadResponse, status_code=201)
async def upload_accessory_image(file: UploadFile = File(...)) -> UploadResponse:
    raw = await file.read()
    try:
        url = upload_service.save_accessory_image(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return UploadResponse(url=url)
