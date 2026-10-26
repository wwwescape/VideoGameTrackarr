from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user
from app.schemas.upload import UploadResponse
from app.services import upload_service

router = APIRouter(prefix="/api/uploads", tags=["uploads"], dependencies=[Depends(get_current_user)])

_CHUNK_SIZE = 1024 * 1024


async def _read_image(file: UploadFile) -> bytes:
    """Reads the upload in chunks, refusing it (413) as soon as it passes the size cap rather
    than holding an arbitrarily large body in memory first."""
    chunks: list[bytes] = []
    size = 0
    while chunk := await file.read(_CHUNK_SIZE):
        size += len(chunk)
        if size > upload_service.MAX_IMAGE_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Image is larger than 20 MB")
        chunks.append(chunk)
    return b"".join(chunks)


async def _save(file: UploadFile, save) -> UploadResponse:
    raw = await _read_image(file)
    try:
        # Decoding and resizing is CPU-bound, so it runs off the event loop.
        url = await run_in_threadpool(save, raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return UploadResponse(url=url)


@router.post("/covers", response_model=UploadResponse, status_code=201)
async def upload_cover(file: UploadFile = File(...)) -> UploadResponse:
    return await _save(file, upload_service.save_cover_image)


@router.post("/accessory-images", response_model=UploadResponse, status_code=201)
async def upload_accessory_image(file: UploadFile = File(...)) -> UploadResponse:
    return await _save(file, upload_service.save_accessory_image)
